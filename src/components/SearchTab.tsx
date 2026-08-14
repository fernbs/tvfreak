import { useState, useEffect, useRef } from 'react'
import { Search, X, Plus, Loader2, TrendingUp, Sparkles, Grid2X2, Grid3X3, List } from 'lucide-react'
import { searchTv, getTrending, getDiscoverByGenres, posterUrl } from '../lib/tmdb'
import { addSeries } from '../lib/api'
import type { TmdbSearchResult, Series } from '../types'
import { useViewMode } from '../lib/useViewMode'
import { toast } from 'sonner'

const GENRES: { id: number; label: string }[] = [
  { id: 10759, label: 'Action & Adventure' },
  { id: 18,    label: 'Drama' },
  { id: 80,    label: 'Crime' },
  { id: 10765, label: 'Sci-Fi & Fantasy' },
  { id: 9648,  label: 'Mystery' },
  { id: 35,    label: 'Comedy' },
  { id: 99,    label: 'Documentary' },
  { id: 16,    label: 'Animation' },
  { id: 10768, label: 'War & Politics' },
  { id: 37,    label: 'Western' },
]

interface Props {
  onSeriesAdded: () => void
  allSeries: Series[]
  onSelect: (series: Series) => void
}

export function SearchTab({ onSeriesAdded, allSeries, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<number[]>([])
  const [results, setResults] = useState<TmdbSearchResult[]>([])
  const [trending, setTrending] = useState<TmdbSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingTrending, setLoadingTrending] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useViewMode()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLoadingTrending(true)
    getTrending().then(r => setTrending(r.slice(0, 20))).finally(() => setLoadingTrending(false))
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim()) {
      debounceRef.current = setTimeout(async () => {
        setSearching(true)
        try {
          const r = await searchTv(query)
          setResults(r.slice(0, 20))
        } finally { setSearching(false) }
      }, 400)
    } else if (selectedGenres.length > 0) {
      debounceRef.current = setTimeout(async () => {
        setSearching(true)
        try {
          const r = await getDiscoverByGenres(selectedGenres)
          setResults(r.slice(0, 20))
        } finally { setSearching(false) }
      }, 200)
    } else {
      setResults([])
    }
  }, [query, selectedGenres])

  function toggleGenre(id: number) {
    setSelectedGenres(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  }

  const libraryIds = new Set(allSeries.map(s => s.tmdbId).filter(Boolean))

  function seriesForPreview(result: TmdbSearchResult): Series {
    const existing = allSeries.find(s => s.tmdbId === result.id)
    if (existing) return existing
    return {
      tmdbId: result.id,
      title: result.name,
      status: 'plantowatch',
      posterPath: result.poster_path,
      overview: result.overview,
      firstAirDate: result.first_air_date,
      lastAirDate: null,
      numberOfSeasons: result.number_of_seasons ?? null,
      notes: '',
      nextEpisodeDate: null,
      nextEpisodeName: null,
      imdbRating: null,
      futureDates: null,
      addedAt: new Date(),
      updatedAt: new Date(),
    }
  }

  async function handleAdd(result: TmdbSearchResult) {
    if (libraryIds.has(result.id)) { toast.error('Already in your library'); return }
    setAddingId(result.id)
    try {
      await addSeries({
        tmdbId: result.id,
        title: result.name,
        status: 'plantowatch',
        posterPath: result.poster_path,
        overview: result.overview,
        firstAirDate: result.first_air_date,
        lastAirDate: null,
        numberOfSeasons: result.number_of_seasons ?? null,
        notes: '',
        nextEpisodeDate: null,
        nextEpisodeName: null,
        imdbRating: null,
        futureDates: null,
        addedAt: new Date(),
        updatedAt: new Date(),
      })
      toast.success(`"${result.name}" added to library`)
      onSeriesAdded()
    } finally { setAddingId(null) }
  }

  const noQuery = !query.trim()
  const noGenres = selectedGenres.length === 0
  const displayResults = (noQuery && noGenres) ? trending : results
  const isLoading = (noQuery && noGenres) ? loadingTrending : searching

  let sectionLabel = ''
  let SectionIcon = TrendingUp
  if (!noQuery) {
    sectionLabel = ''
  } else if (!noGenres) {
    sectionLabel = 'Top rated · ' + selectedGenres.map(id => GENRES.find(g => g.id === id)?.label).join(', ')
    SectionIcon = Sparkles
  } else {
    sectionLabel = 'Trending this week'
    SectionIcon = TrendingUp
  }

  function AddButton({ r }: { r: TmdbSearchResult }) {
    const inLibrary = libraryIds.has(r.id)
    if (inLibrary) {
      return <span className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium text-white/30 bg-white/5">In library</span>
    }
    return (
      <button
        onClick={e => { e.stopPropagation(); handleAdd(r) }}
        disabled={addingId === r.id}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-[#6366F1]/15 text-[#6366F1] active:bg-[#6366F1]/30 transition-colors disabled:opacity-50"
      >
        {addingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div
        className="shrink-0 bg-[#0A0A0A] px-4 pb-3 z-10"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-white">Search</h1>
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-white/6 rounded-lg p-0.5">
            {([['big', Grid2X2], ['small', Grid3X3], ['list', List]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded-md transition-colors ${viewMode === mode ? 'bg-white/12 text-white' : 'text-white/30'}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl bg-[#1E1E1E] border border-white/8 focus-within:border-white/20 transition-colors mb-3">
          {searching && query.trim() ? (
            <Loader2 className="w-4 h-4 text-white/40 shrink-0 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-white/40 shrink-0" />
          )}
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search TMDB for a series..."
            style={{ fontSize: 16 }}
            className="flex-1 bg-transparent text-white placeholder:text-white/30 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="shrink-0">
              <X className="w-4 h-4 text-white/40" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {GENRES.map(g => {
            const active = selectedGenres.includes(g.id)
            return (
              <button
                key={g.id}
                onClick={() => toggleGenre(g.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active ? 'bg-[#6366F1] text-white' : 'bg-white/6 text-white/45 active:bg-white/12'
                }`}
              >
                {g.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        {sectionLabel && (
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
            <SectionIcon className="w-3.5 h-3.5 text-white/30" />
            <span className="text-xs font-medium text-white/30 uppercase tracking-wider truncate">{sectionLabel}</span>
            {isLoading && <Loader2 className="w-3 h-3 text-white/20 animate-spin shrink-0" />}
          </div>
        )}

        {displayResults.length === 0 && !isLoading ? (
          query.trim() ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-6">
              <p className="text-sm text-white/25">No results for "{query}"</p>
            </div>
          ) : null
        ) : viewMode === 'list' ? (
          <div className="pb-6">
            {displayResults.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 border-b border-white/4">
                <button
                  onClick={() => onSelect(seriesForPreview(r))}
                  className="flex items-center gap-3 flex-1 min-w-0 py-3 text-left active:opacity-70 transition-opacity"
                >
                  <div className="w-10 h-[60px] rounded-lg shrink-0 overflow-hidden bg-[#2A2A2A]">
                    {r.poster_path && (
                      <img src={posterUrl(r.poster_path, 'w185') ?? ''} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-snug truncate">{r.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-white/35">{r.first_air_date ? r.first_air_date.slice(0, 4) : 'Unknown year'}</p>
                      {(r.vote_average ?? 0) > 0 && (
                        <span className="text-xs text-yellow-400">★ {r.vote_average!.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </button>
                <AddButton r={r} />
              </div>
            ))}
          </div>
        ) : (
          <div className={`px-4 pt-2 pb-6 grid gap-2.5 ${viewMode === 'big' ? 'grid-cols-2' : 'grid-cols-3 sm:grid-cols-4'}`}>
            {displayResults.map(r => {
              const inLibrary = libraryIds.has(r.id)
              return (
                <button
                  key={r.id}
                  onClick={() => onSelect(seriesForPreview(r))}
                  className="relative text-left active:opacity-70 transition-opacity"
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#1E1E1E] mb-1.5 relative">
                    {r.poster_path ? (
                      <img src={posterUrl(r.poster_path, 'w342') ?? ''} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2">
                        <span className="text-[10px] text-white/20 text-center">{r.name}</span>
                      </div>
                    )}
                    {/* Add button overlay */}
                    {!inLibrary && (
                      <button
                        onClick={e => { e.stopPropagation(); handleAdd(r) }}
                        disabled={addingId === r.id}
                        className="absolute bottom-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-lg bg-black/70 text-white active:bg-black/90 transition-colors disabled:opacity-50"
                      >
                        {addingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {inLibrary && (
                      <div className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded bg-[#6366F1]/80">
                        <span className="text-[9px] text-white font-bold">✓</span>
                      </div>
                    )}
                    {(r.vote_average ?? 0) > 0 && (
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60">
                        <span className="text-[10px] text-yellow-400 font-medium">★ {r.vote_average!.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-white/60 leading-tight line-clamp-2">{r.name}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
