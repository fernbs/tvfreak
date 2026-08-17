import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Check, SkipForward, Download, ChevronRight, Film, Search } from 'lucide-react'
import { addMovie, addMoviesBatch } from '../lib/api'
import { searchMovie } from '../lib/tmdb'

const IMPORT_DONE_KEY = 'tvfreak-movie-import-done'
const IMPORT_JSON_URL = `${import.meta.env.BASE_URL}movie-import.json`
const BATCH_SIZE = 100

interface Candidate {
  tmdbId: number
  title: string
  year: string | null
  posterPath: string | null
}

interface ImportEntry {
  csvTitle: string
  status: 'matched' | 'ambiguous' | 'no_match'
  tmdbId?: number
  title?: string
  year?: string | null
  posterPath?: string | null
  candidates?: Candidate[]
}

interface ImportData {
  movies: ImportEntry[]
}

function posterUrl(path: string | null, size = 'w185') {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null
}

async function saveMovie(entry: { tmdbId: number; title: string; year: string | null; posterPath: string | null }) {
  await addMovie({
    tmdbId: entry.tmdbId,
    title: entry.title,
    status: 'completed',
    posterPath: entry.posterPath ?? null,
    overview: null,
    releaseDate: entry.year ? `${entry.year}-01-01` : null,
    runtime: null,
    notes: '',
    imdbRating: null,
    addedAt: new Date(),
    updatedAt: new Date(),
  })
}

// ── Banner ────────────────────────────────────────────────────────────────────
interface BannerProps {
  onOpen: () => void
  count: number
}

export function MovieImportBanner({ onOpen, count }: BannerProps) {
  return (
    <button
      onClick={onOpen}
      className="mx-4 mb-3 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[rgba(191,90,242,0.1)] border border-[rgba(191,90,242,0.25)] active:bg-[rgba(191,90,242,0.18)] transition-colors text-left w-[calc(100%-2rem)]"
    >
      <div className="w-9 h-9 rounded-xl bg-[rgba(191,90,242,0.15)] flex items-center justify-center shrink-0">
        <Download className="w-4.5 h-4.5 text-[#BF5AF2]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#F5F5F7]">Import your movie history</p>
        <p className="text-xs text-[#8E8E93] mt-0.5">{count.toLocaleString()} movies ready to add</p>
      </div>
      <ChevronRight className="w-4 h-4 text-[#48484A] shrink-0" />
    </button>
  )
}

// ── Main sheet ────────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void
  onImportDone: () => void
}

type Stage = 'summary' | 'bulk-importing' | 'review' | 'done'

export function MovieImportSheet({ onClose, onImportDone }: Props) {
  const [data, setData] = useState<ImportData | null>(null)
  const [stage, setStage] = useState<Stage>('summary')
  const [reviewQueue, setReviewQueue] = useState<ImportEntry[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [bulkProgress, setBulkProgress] = useState(0)
  const [bulkTotal, setBulkTotal] = useState(0)
  const [bulkFailed, setBulkFailed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(IMPORT_JSON_URL)
      .then(r => r.json())
      .then((d: ImportData) => setData(d))
      .catch(() => setError('Could not load import file.'))
  }, [])

  const matched = data?.movies.filter(m => m.status === 'matched') ?? []
  const ambiguous = data?.movies.filter(m => m.status === 'ambiguous') ?? []
  const noMatch = data?.movies.filter(m => m.status === 'no_match') ?? []

  const handleBulkImport = useCallback(async () => {
    setStage('bulk-importing')

    const toImport = matched
      .filter(m => m.tmdbId && m.title)
      .map(m => ({
        tmdbId: m.tmdbId!,
        title: m.title!,
        status: 'completed' as const,
        posterPath: m.posterPath ?? null,
        overview: null,
        releaseDate: m.year ? `${m.year}-01-01` : null,
        runtime: null,
        notes: '' as string,
        imdbRating: null,
        addedAt: new Date(),
        updatedAt: new Date(),
      }))

    setBulkTotal(toImport.length)

    let failed = 0
    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      const batch = toImport.slice(i, i + BATCH_SIZE)
      try {
        await addMoviesBatch(batch)
      } catch {
        failed += batch.length
      }
      setBulkProgress(Math.min(i + BATCH_SIZE, toImport.length))
    }

    setBulkFailed(failed)

    if (ambiguous.length > 0) {
      setReviewQueue(ambiguous)
      setReviewIndex(0)
      setStage('review')
    } else {
      markDone()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, ambiguous])

  const handleSkipBulk = useCallback(() => {
    if (ambiguous.length > 0) {
      setReviewQueue(ambiguous)
      setReviewIndex(0)
      setStage('review')
    } else {
      markDone()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambiguous])

  const markDone = () => {
    localStorage.setItem(IMPORT_DONE_KEY, '1')
    onImportDone()
    setStage('done')
  }

  const handleSelectCandidate = async (candidate: Candidate) => {
    try {
      await saveMovie({ tmdbId: candidate.tmdbId, title: candidate.title, year: candidate.year, posterPath: candidate.posterPath })
    } catch { /* skip */ }
    advance()
  }

  const advance = () => {
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    const next = reviewIndex + 1
    if (next >= reviewQueue.length) {
      markDone()
    } else {
      setReviewIndex(next)
    }
  }

  const handleTmdbSearch = async (query: string) => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const { results } = await searchMovie(query)
      setSearchResults(results.slice(0, 10).map(r => ({
        tmdbId: r.id,
        title: r.name,
        year: r.first_air_date ? r.first_air_date.substring(0, 4) : null,
        posterPath: r.poster_path,
      })))
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const currentItem = reviewQueue[reviewIndex]
  const reviewProgress = reviewQueue.length > 0 ? `${reviewIndex + 1} / ${reviewQueue.length}` : ''

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed left-0 right-0 bottom-0 z-50 bg-[#111111] rounded-t-2xl shadow-2xl border-t border-white/8 overflow-hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/6">
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-[#BF5AF2]" />
            <span className="text-base font-bold text-[#F5F5F7]">
              {stage === 'summary' && 'Import Movie History'}
              {stage === 'bulk-importing' && 'Importing…'}
              {stage === 'review' && `Review · ${reviewProgress}`}
              {stage === 'done' && 'Import Complete'}
            </span>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/8">
            <X className="w-3.5 h-3.5 text-[#8E8E93]" />
          </button>
        </div>

        {error && (
          <div className="px-5 py-8 text-center">
            <p className="text-[#FB7185] text-sm">{error}</p>
          </div>
        )}

        {!data && !error && (
          <div className="px-5 py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#BF5AF2] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* ── Summary ── */}
        {data && stage === 'summary' && (
          <div className="px-5 py-5 overflow-y-auto">
            <p className="text-[#8E8E93] text-sm mb-5">
              Found {data.movies.length.toLocaleString()} movies in your CSV. Here's what we matched against TMDB:
            </p>
            <div className="space-y-2.5 mb-6">
              <StatRow color="#34D399" label="Auto-matched" count={matched.length} note="ready to import" />
              <StatRow color="#FBBF24" label="Needs confirmation" count={ambiguous.length} note="pick from options" />
              <StatRow color="#48484A" label="Not found" count={noMatch.length} note="will be skipped" />
            </div>
            {matched.length > 0 && (
              <button
                onClick={handleBulkImport}
                className="w-full py-3.5 rounded-2xl bg-[#BF5AF2] text-white text-sm font-bold mb-3 active:opacity-80 transition-opacity"
              >
                Import all {matched.length.toLocaleString()} matched movies
              </button>
            )}
            {ambiguous.length > 0 && (
              <button
                onClick={handleSkipBulk}
                className="w-full py-3 rounded-2xl bg-white/6 text-[#F5F5F7] text-sm font-semibold mb-2 active:opacity-70 transition-opacity border border-white/8"
              >
                {matched.length > 0 ? `Skip bulk · review ${ambiguous.length} ambiguous` : `Review ${ambiguous.length} movies`}
              </button>
            )}
            {matched.length === 0 && ambiguous.length === 0 && (
              <button onClick={markDone} className="w-full py-3 rounded-2xl bg-white/6 text-[#8E8E93] text-sm font-semibold">
                Close
              </button>
            )}
          </div>
        )}

        {/* ── Bulk importing ── */}
        {stage === 'bulk-importing' && (
          <div className="px-5 py-10 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-[#BF5AF2] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#F5F5F7] text-base font-semibold">
              {bulkProgress} / {bulkTotal}
            </p>
            <p className="text-[#48484A] text-xs">Adding movies to your library…</p>
            <div className="w-full h-1 bg-white/6 rounded-full mt-2">
              <div
                className="h-full bg-[#BF5AF2] rounded-full transition-all duration-200"
                style={{ width: `${bulkTotal > 0 ? (bulkProgress / bulkTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Review ── */}
        {data && stage === 'review' && currentItem && (
          <div className="px-5 pt-4 pb-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 70px)' }}>
            <p className="text-[#8E8E93] text-xs mb-1">Your title</p>
            <p className="text-[#F5F5F7] text-base font-semibold mb-4">{currentItem.csvTitle}</p>

            {currentItem.candidates && currentItem.candidates.length > 0 && (
              <>
                <p className="text-[#48484A] text-xs mb-3">Pick the right film:</p>
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                  {currentItem.candidates.map(c => (
                    <CandidateCard key={c.tmdbId} candidate={c} onSelect={handleSelectCandidate} />
                  ))}
                  {searchResults.map(c => (
                    <CandidateCard key={`sr-${c.tmdbId}`} candidate={c} onSelect={handleSelectCandidate} />
                  ))}
                </div>
              </>
            )}

            {currentItem.status === 'no_match' && searchResults.length === 0 && (
              <p className="text-[#48484A] text-sm mb-2">No match found on TMDB.</p>
            )}
            {currentItem.status === 'no_match' && searchResults.length > 0 && (
              <>
                <p className="text-[#48484A] text-xs mb-3">Search results:</p>
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                  {searchResults.map(c => (
                    <CandidateCard key={`sr-${c.tmdbId}`} candidate={c} onSelect={handleSelectCandidate} />
                  ))}
                </div>
              </>
            )}

            {/* TMDB search */}
            {!showSearch ? (
              <button
                onClick={() => {
                  setShowSearch(true)
                  setSearchQuery(currentItem.csvTitle)
                  setTimeout(() => searchInputRef.current?.focus(), 100)
                }}
                className="mt-3 flex items-center gap-1.5 text-xs text-[#BF5AF2] py-1"
              >
                <Search className="w-3 h-3" />
                Not finding it? Search TMDB
              </button>
            ) : (
              <div className="mt-3 flex gap-2">
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTmdbSearch(searchQuery)}
                  placeholder={currentItem.csvTitle}
                  className="flex-1 bg-[#1C1C1E] border border-white/10 rounded-xl px-3 py-2 text-sm text-[#F5F5F7] placeholder:text-[#48484A] outline-none focus:border-[rgba(191,90,242,0.5)]"
                />
                <button
                  onClick={() => handleTmdbSearch(searchQuery || currentItem.csvTitle)}
                  disabled={searching}
                  className="px-3 py-2 rounded-xl bg-[#BF5AF2] text-white text-xs font-semibold disabled:opacity-50 shrink-0"
                >
                  {searching ? '…' : 'Search'}
                </button>
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={advance}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/6 border border-white/8 text-[#8E8E93] text-sm font-medium active:opacity-70 transition-opacity"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Skip
              </button>
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {stage === 'done' && (
          <div className="px-5 py-10 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-[rgba(52,211,153,0.15)] flex items-center justify-center">
              <Check className="w-7 h-7 text-[#34D399]" />
            </div>
            <p className="text-[#F5F5F7] text-lg font-bold">All done!</p>
            <p className="text-[#8E8E93] text-sm">
              Your movie history has been imported.
            </p>
            {bulkFailed > 0 && (
              <p className="text-[#FB7185] text-xs">{bulkFailed} movies couldn't be saved and were skipped.</p>
            )}
            <button
              onClick={onClose}
              className="mt-2 px-8 py-3 rounded-2xl bg-[#BF5AF2] text-white text-sm font-bold active:opacity-80 transition-opacity"
            >
              Go to Library
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Candidate card ──────────────────────────────────────────────────────────────
function CandidateCard({ candidate, onSelect }: { candidate: Candidate; onSelect: (c: Candidate) => void }) {
  return (
    <button
      onClick={() => onSelect(candidate)}
      className="shrink-0 flex flex-col gap-1.5 active:opacity-70 transition-opacity"
    >
      <div className="w-[110px] aspect-[2/3] rounded-xl overflow-hidden bg-[#1C1C1E]">
        {posterUrl(candidate.posterPath) ? (
          <img src={posterUrl(candidate.posterPath)!} alt={candidate.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-2">
            <span className="text-[9px] text-[#48484A] text-center">{candidate.title}</span>
          </div>
        )}
      </div>
      <p className="text-[11px] text-[#F5F5F7] font-medium text-center w-[110px] leading-tight line-clamp-2">{candidate.title}</p>
      {candidate.year && <p className="text-[10px] text-[#48484A] text-center">{candidate.year}</p>}
    </button>
  )
}

// ── Helper ─────────────────────────────────────────────────────────────────────
function StatRow({ color, label, count, note }: { color: string; label: string; count: number; note: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-[#1C1C1E] rounded-xl">
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-sm font-medium text-[#F5F5F7] flex-1">{label}</span>
      <span className="text-sm font-bold" style={{ color }}>{count.toLocaleString()}</span>
      <span className="text-xs text-[#48484A]">{note}</span>
    </div>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useMovieImport(moviesLoaded: boolean, moviesCount: number) {
  const [importData, setImportData] = useState<ImportData | null>(null)
  const [importDone, setImportDone] = useState(() => !!localStorage.getItem(IMPORT_DONE_KEY))
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (moviesLoaded && moviesCount === 0 && importDone) {
      localStorage.removeItem(IMPORT_DONE_KEY)
      setImportDone(false)
    }
  }, [moviesLoaded, moviesCount, importDone])

  useEffect(() => {
    if (importDone) return
    fetch(IMPORT_JSON_URL)
      .then(r => r.json())
      .then((d: ImportData) => { if (d?.movies?.length) setImportData(d) })
      .catch(() => { /* no import file */ })
  }, [importDone])

  const matchCount = importData?.movies.filter(m => m.status !== 'no_match').length ?? 0
  const showBanner = !importDone && importData !== null && matchCount > 0

  return {
    showBanner,
    matchCount,
    sheetOpen,
    openSheet: () => setSheetOpen(true),
    closeSheet: () => setSheetOpen(false),
    onImportDone: () => { setImportDone(true); setSheetOpen(false) },
  }
}
