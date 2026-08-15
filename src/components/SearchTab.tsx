import { useState, useEffect, useRef } from 'react'
import { Search, X, Plus, Loader2, TrendingUp, Sparkles, Grid2X2, Grid3X3, List, ChevronDown } from 'lucide-react'
import { TVFreakIcon } from './TVFreakIcon'
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
  const [includedGenres, setIncludedGenres] = useState<number[]>([])
  const [excludedGenres, setExcludedGenres] = useState<number[]>([])
  const [sortBy, setSortBy] = useState('vote_average.desc')
  const [yearFilter, setYearFilter] = useState('')
  const [results, setResults] = useState<TmdbSearchResult[]>([])
  const [trending, setTrending] = useState<TmdbSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingTrending, setLoadingTrending] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useViewMode()
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [trendingPage, setTrendingPage] = useState(1)
  const [trendingTotalPages, setTrendingTotalPages] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLoadingTrending(true)
    getTrending(1).then(({ results: r, totalPages: tp }) => {
      setTrending(r)
      setTrendingTotalPages(tp)
    }).finally(() => setLoadingTrending(false))
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const hasQuery = query.trim().length > 0
    const hasGenreFilter = includedGenres.length > 0 || excludedGenres.length > 0

    if (!hasQuery && !hasGenreFilter) {
      setResults([])
      setCurrentPage(1)
      setTotalPages(1)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setCurrentPage(1)
      const year = yearFilter.length === 4 ? yearFilter : undefined
      try {
        if (hasQuery) {
          const { results: r, totalPages: tp } = await searchTv(query, 1, year)
          setResults(r)
          setTotalPages(tp)
        } else {
          const { results: r, totalPages: tp } = await getDiscoverByGenres(includedGenres, excludedGenres, 1, sortBy, year)
          setResults(r)
          setTotalPages(tp)
        }
      } finally { setSearching(false) }
    }, hasQuery ? 400 : 200)
  }, [query, includedGenres, excludedGenres, sortBy, yearFilter])

  function toggleGenre(id: number) {
    if (includedGenres.includes(id)) {
      setIncludedGenres(prev => prev.filter(g => g !== id))
      setExcludedGenres(prev => [...prev, id])
    } else if (excludedGenres.includes(id)) {
      setExcludedGenres(prev => prev.filter(g => g !== id))
    } else {
      setIncludedGenres(prev => [...prev, id])
    }
  }

  async function handleLoadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      if (showTrending) {
        const nextPage = trendingPage + 1
        const { results: r, totalPages: tp } = await getTrending(nextPage)
        setTrending(prev => [...prev, ...r])
        setTrendingTotalPages(tp)
        setTrendingPage(nextPage)
      } else {
        const nextPage = currentPage + 1
        const year = yearFilter.length === 4 ? yearFilter : undefined
        const hasQuery = query.trim().length > 0
        if (hasQuery) {
          const { results: r, totalPages: tp } = await searchTv(query, nextPage, year)
          setResults(prev => [...prev, ...r])
          setTotalPages(tp)
        } else {
          const { results: r, totalPages: tp } = await getDiscoverByGenres(includedGenres, excludedGenres, nextPage, sortBy, year)
          setResults(prev => [...prev, ...r])
          setTotalPages(tp)
        }
        setCurrentPage(nextPage)
      }
    } finally { setLoadingMore(false) }
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
        status: 'watching',
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

  function applySort(items: TmdbSearchResult[]): TmdbSearchResult[] {
    return [...items].sort((a, b) => {
      if (sortBy === 'vote_average.desc') return (b.vote_average ?? 0) - (a.vote_average ?? 0)
      if (sortBy === 'popularity.desc') return (b.popularity ?? 0) - (a.popularity ?? 0)
      if (sortBy === 'first_air_date.desc') return (b.first_air_date ?? '').localeCompare(a.first_air_date ?? '')
      if (sortBy === 'first_air_date.asc') return (a.first_air_date ?? '').localeCompare(b.first_air_date ?? '')
      return 0
    })
  }

  const noQuery = !query.trim()
  const noGenreFilter = includedGenres.length === 0 && excludedGenres.length === 0
  const showTrending = noQuery && noGenreFilter
  const displayResults = applySort(showTrending ? trending : results)
  const isLoading = showTrending ? loadingTrending : searching
  const hasMore = showTrending ? trendingPage < trendingTotalPages : currentPage < totalPages

  let sectionLabel = ''
  let SectionIcon = TrendingUp
  if (!noQuery) {
    sectionLabel = ''
  } else if (!noGenreFilter) {
    const parts = [
      ...includedGenres.map(id => GENRES.find(g => g.id === id)?.label ?? ''),
      ...excludedGenres.map(id => `not ${GENRES.find(g => g.id === id)?.label ?? ''}`),
    ].filter(Boolean)
    sectionLabel = 'Top rated · ' + parts.join(', ')
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
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TVFreakIcon size={22} />
            <h1 className="text-lg font-bold text-white">Search</h1>
          </div>
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

        {/* Genre chips — tap once to include (indigo), tap again to exclude (red), tap again to clear */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {GENRES.map(g => {
            const isIncluded = includedGenres.includes(g.id)
            const isExcluded = excludedGenres.includes(g.id)
            return (
              <button
                key={g.id}
                onClick={() => toggleGenre(g.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isIncluded
                    ? 'bg-[#6366F1] text-white'
                    : isExcluded
                      ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                      : 'bg-white/6 text-white/45 active:bg-white/12'
                }`}
              >
                {isExcluded ? '× ' : ''}{g.label}
              </button>
            )
          })}
        </div>

        {/* Sort + year row */}
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="w-full bg-[#1E1E1E] border border-white/8 rounded-xl px-3 pr-7 py-1.5 text-xs text-white/70 outline-none appearance-none"
            >
              <option value="vote_average.desc">Top Rated</option>
              <option value="popularity.desc">Most Popular</option>
              <option value="first_air_date.desc">Newest First</option>
              <option value="first_air_date.asc">Oldest First</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
          </div>
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            style={{ fontSize: 16 }}
            className="w-24 bg-[#1E1E1E] border border-white/8 rounded-xl px-3 py-1.5 text-xs text-white/70 outline-none appearance-none"
          >
            <option value="">Any year</option>
            {Array.from({ length: 2027 - 1950 + 1 }, (_, i) => 2027 - i).map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
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
            {hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/6 text-white/50 text-sm font-medium active:bg-white/10 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {loadingMore ? 'Loading...' : `Load more`}
                </button>
              </div>
            )}
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
                      <div className="absolute top-1.5 left-1.5 flex items-center px-1.5 rounded bg-black/60" style={{ height: '16px' }}>
                        <span className="text-[10px] text-yellow-400 font-medium leading-none">★ {r.vote_average!.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-white/60 leading-tight line-clamp-2">{r.name}</p>
                </button>
              )
            })}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="active:opacity-60 transition-opacity disabled:opacity-30"
              >
                <div className="aspect-[2/3] rounded-xl bg-[#1E1E1E] border border-dashed border-white/12 flex flex-col items-center justify-center gap-2">
                  {loadingMore
                    ? <Loader2 className="w-5 h-5 text-white/25 animate-spin" />
                    : <><Plus className="w-5 h-5 text-white/25" /><span className="text-[10px] text-white/25 font-medium leading-none">Load more</span></>
                  }
                </div>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
