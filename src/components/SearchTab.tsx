import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Plus, Loader2, TrendingUp, Sparkles, Grid2X2, Grid3X3, List, ChevronDown, BookmarkCheck } from 'lucide-react'
import { TVFreakIcon } from './TVFreakIcon'
import { searchTv, getTrending, getDiscoverByGenres, getStreamingProviders, posterUrl, IMG_BASE, searchMovie, getTrendingMovies, discoverMovies, getMovieStreamingProviders } from '../lib/tmdb'
import { addSeries, addMovie } from '../lib/api'
import type { TmdbSearchResult, Series, Movie, WatchProvider } from '../types'
import { useViewMode } from '../lib/useViewMode'
import { getCountry, getDefaultProviders } from '../lib/settings'
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

const MOVIE_GENRES: { id: number; label: string }[] = [
  { id: 28,    label: 'Action' },
  { id: 12,    label: 'Adventure' },
  { id: 16,    label: 'Animation' },
  { id: 35,    label: 'Comedy' },
  { id: 80,    label: 'Crime' },
  { id: 99,    label: 'Documentary' },
  { id: 18,    label: 'Drama' },
  { id: 14,    label: 'Fantasy' },
  { id: 27,    label: 'Horror' },
  { id: 9648,  label: 'Mystery' },
  { id: 10749, label: 'Romance' },
  { id: 878,   label: 'Sci-Fi' },
  { id: 53,    label: 'Thriller' },
  { id: 10752, label: 'War' },
  { id: 37,    label: 'Western' },
]

interface Props {
  onSeriesAdded: () => void
  allSeries: Series[]
  onSelect: (series: Series) => void
  allMovies: Movie[]
  onMovieAdded: () => void
  onMovieSelect: (movie: Movie) => void
}

export function SearchTab({ onSeriesAdded, allSeries, onSelect, allMovies, onMovieAdded, onMovieSelect }: Props) {
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
  const [availableProviders, setAvailableProviders] = useState<WatchProvider[]>([])
  const [selectedProviders, setSelectedProviders] = useState<number[]>(getDefaultProviders)
  const [hideInLibrary, setHideInLibrary] = useState(false)
  const [newItemIds, setNewItemIds] = useState<Set<number>>(new Set())
  const [mediaMode, setMediaMode] = useState<'tv' | 'movie'>('tv')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const handleLoadMoreRef = useRef<() => void>(() => {})

  const genres = mediaMode === 'tv' ? GENRES : MOVIE_GENRES

  function switchMediaMode(mode: 'tv' | 'movie') {
    if (mode === mediaMode) return
    setMediaMode(mode)
    setIncludedGenres([])
    setExcludedGenres([])
    setQuery('')
    setYearFilter('')
    setResults([])
    setTrending([])
    setTrendingPage(1)
    setCurrentPage(1)
  }

  const noQuery = !query.trim()
  const noGenreFilter = includedGenres.length === 0 && excludedGenres.length === 0
  const noProviderFilter = selectedProviders.length === 0
  const noYearFilter = yearFilter.length !== 4
  const showTrending = noQuery && noGenreFilter && noProviderFilter && noYearFilter
  const hasMore = showTrending ? trendingPage < trendingTotalPages : currentPage < totalPages

  const sortedProviders = useMemo(() => {
    const sel = availableProviders.filter(p => selectedProviders.includes(p.provider_id))
    const unsel = availableProviders.filter(p => !selectedProviders.includes(p.provider_id))
    return [...sel, ...unsel]
  }, [availableProviders, selectedProviders])

  useEffect(() => {
    setLoadingTrending(true)
    setTrending([])
    const fetchFn = mediaMode === 'tv' ? getTrending : getTrendingMovies
    Promise.all([fetchFn(1), fetchFn(2)]).then(([p1, p2]) => {
      setTrending([...p1.results, ...p2.results])
      setTrendingTotalPages(p1.totalPages)
      setTrendingPage(Math.min(2, p1.totalPages))
    }).finally(() => setLoadingTrending(false))
    const providerFn = mediaMode === 'tv' ? getStreamingProviders : getMovieStreamingProviders
    providerFn(getCountry()).then(setAvailableProviders)
  }, [mediaMode])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const hasQuery = query.trim().length > 0
    const hasGenreFilter = includedGenres.length > 0 || excludedGenres.length > 0
    const hasProviderFilter = selectedProviders.length > 0
    const hasYearFilter = yearFilter.length === 4

    if (!hasQuery && !hasGenreFilter && !hasProviderFilter && !hasYearFilter) {
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
        if (mediaMode === 'tv') {
          if (hasQuery) {
            const [p1, p2] = await Promise.all([searchTv(query, 1, year), searchTv(query, 2, year)])
            setResults([...p1.results, ...p2.results])
            setTotalPages(p1.totalPages)
            setCurrentPage(Math.min(2, p1.totalPages))
          } else {
            const [p1, p2] = await Promise.all([
              getDiscoverByGenres(includedGenres, excludedGenres, 1, sortBy, year, selectedProviders, getCountry()),
              getDiscoverByGenres(includedGenres, excludedGenres, 2, sortBy, year, selectedProviders, getCountry()),
            ])
            setResults([...p1.results, ...p2.results])
            setTotalPages(p1.totalPages)
            setCurrentPage(Math.min(2, p1.totalPages))
          }
        } else {
          if (hasQuery) {
            const [p1, p2] = await Promise.all([searchMovie(query, 1, year), searchMovie(query, 2, year)])
            setResults([...p1.results, ...p2.results])
            setTotalPages(p1.totalPages)
            setCurrentPage(Math.min(2, p1.totalPages))
          } else {
            const [p1, p2] = await Promise.all([
              discoverMovies(includedGenres, excludedGenres, 1, sortBy, year, selectedProviders, getCountry()),
              discoverMovies(includedGenres, excludedGenres, 2, sortBy, year, selectedProviders, getCountry()),
            ])
            setResults([...p1.results, ...p2.results])
            setTotalPages(p1.totalPages)
            setCurrentPage(Math.min(2, p1.totalPages))
          }
        }
      } finally { setSearching(false) }
    }, hasQuery ? 400 : 200)
  }, [query, includedGenres, excludedGenres, sortBy, yearFilter, selectedProviders, mediaMode])

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

  function toggleProvider(id: number) {
    setSelectedProviders(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  async function handleLoadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const year = yearFilter.length === 4 ? yearFilter : undefined
      const hasQuery = query.trim().length > 0
      let freshItems: TmdbSearchResult[] = []
      if (showTrending) {
        const p1 = trendingPage + 1
        const p2 = trendingPage + 2
        const trendFn = mediaMode === 'tv' ? getTrending : getTrendingMovies
        const fetches = p2 <= trendingTotalPages
          ? [trendFn(p1), trendFn(p2)]
          : [trendFn(p1)]
        const pages = await Promise.all(fetches)
        freshItems = pages.flatMap(p => p.results)
        setTrending(prev => [...prev, ...freshItems])
        setTrendingTotalPages(pages[0].totalPages)
        setTrendingPage(fetches.length === 2 ? p2 : p1)
      } else {
        const p1 = currentPage + 1
        const p2 = currentPage + 2
        if (hasQuery) {
          const searchFn = mediaMode === 'tv' ? searchTv : searchMovie
          const fetches = p2 <= totalPages
            ? [searchFn(query, p1, year), searchFn(query, p2, year)]
            : [searchFn(query, p1, year)]
          const pages = await Promise.all(fetches)
          freshItems = pages.flatMap(p => p.results)
          setResults(prev => [...prev, ...freshItems])
          setTotalPages(pages[0].totalPages)
          setCurrentPage(fetches.length === 2 ? p2 : p1)
        } else {
          const discoverFn = mediaMode === 'tv' ? getDiscoverByGenres : discoverMovies
          const fetches = p2 <= totalPages
            ? [discoverFn(includedGenres, excludedGenres, p1, sortBy, year, selectedProviders, getCountry()),
               discoverFn(includedGenres, excludedGenres, p2, sortBy, year, selectedProviders, getCountry())]
            : [discoverFn(includedGenres, excludedGenres, p1, sortBy, year, selectedProviders, getCountry())]
          const pages = await Promise.all(fetches)
          freshItems = pages.flatMap(p => p.results)
          setResults(prev => [...prev, ...freshItems])
          setTotalPages(pages[0].totalPages)
          setCurrentPage(fetches.length === 2 ? p2 : p1)
        }
      }
      if (freshItems.length > 0) setNewItemIds(new Set(freshItems.map(r => r.id)))
    } finally { setLoadingMore(false) }
  }

  handleLoadMoreRef.current = handleLoadMore

  useEffect(() => {
    if (!hasMore || loadingMore) return
    const sentinel = sentinelRef.current
    const container = scrollRef.current
    if (!sentinel || !container) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleLoadMoreRef.current() },
      { root: container, rootMargin: '0px 0px 100px 0px', threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore])

  useEffect(() => {
    if (newItemIds.size === 0) return
    const t = setTimeout(() => setNewItemIds(new Set()), 700)
    return () => clearTimeout(t)
  }, [newItemIds])

  const libraryIds = new Set(
    (mediaMode === 'tv' ? allSeries : allMovies).map(s => s.tmdbId).filter(Boolean) as number[]
  )

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

  function movieForPreview(result: TmdbSearchResult): Movie {
    const existing = allMovies.find(m => m.tmdbId === result.id)
    if (existing) return existing
    return {
      tmdbId: result.id,
      title: result.name,
      status: 'plantowatch',
      posterPath: result.poster_path,
      overview: result.overview,
      releaseDate: result.first_air_date ?? null,
      runtime: null,
      notes: '',
      imdbRating: (result.vote_average ?? 0) > 0 ? result.vote_average!.toFixed(1) : null,
      addedAt: new Date(),
      updatedAt: new Date(),
    }
  }

  async function handleAdd(result: TmdbSearchResult) {
    if (libraryIds.has(result.id)) { toast.error('Already in your library'); return }
    setAddingId(result.id)
    try {
      if (mediaMode === 'tv') {
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
      } else {
        await addMovie({
          tmdbId: result.id,
          title: result.name,
          status: 'plantowatch',
          posterPath: result.poster_path,
          overview: result.overview,
          releaseDate: result.first_air_date ?? null,
          runtime: null,
          notes: '',
          imdbRating: null,
          addedAt: new Date(),
          updatedAt: new Date(),
        })
        toast.success(`"${result.name}" added to watchlist`)
        onMovieAdded()
      }
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

  const displayResults = applySort(showTrending ? trending : results)
  const visibleResults = hideInLibrary ? displayResults.filter(r => !libraryIds.has(r.id)) : displayResults
  const isLoading = showTrending ? loadingTrending : searching

  let sectionLabel = ''
  let SectionIcon = TrendingUp
  if (!noQuery) {
    sectionLabel = ''
  } else if (!noGenreFilter || !noProviderFilter) {
    const genreParts = [
      ...includedGenres.map(id => genres.find(g => g.id === id)?.label ?? ''),
      ...excludedGenres.map(id => `not ${genres.find(g => g.id === id)?.label ?? ''}`),
    ].filter(Boolean)
    const providerParts = selectedProviders
      .map(id => availableProviders.find(p => p.provider_id === id)?.provider_name ?? '')
      .filter(Boolean)
    let label = 'Top rated'
    if (genreParts.length > 0) label += ' · ' + genreParts.join(', ')
    if (providerParts.length > 0) label += ' on ' + providerParts.join(', ')
    sectionLabel = label
    SectionIcon = Sparkles
  } else {
    sectionLabel = 'Trending this week'
    SectionIcon = TrendingUp
  }

  const viewToggleClasses = (mode: string) =>
    `p-1.5 rounded-lg transition-colors ${viewMode === mode
      ? 'bg-[#2C2C2E] text-[#F5F5F7]'
      : 'text-[#48484A] active:text-[#8E8E93]'
    }`

  function AddButton({ r }: { r: TmdbSearchResult }) {
    const inLib = libraryIds.has(r.id)
    if (inLib) {
      return (
        <div className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded bg-[#FF8C00]/80">
          <span className="text-[9px] text-white font-bold">✓</span>
        </div>
      )
    }
    return (
      <button
        onClick={e => { e.stopPropagation(); handleAdd(r) }}
        disabled={addingId === r.id}
        className="absolute bottom-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-lg bg-black/80 text-[#FF9F0A] border border-white/15 active:bg-[rgba(255,159,10,0.5)] transition-colors disabled:opacity-50"
      >
        {addingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full bg-black">

      {/* Sticky header */}
      <div
        className="shrink-0 bg-black px-4 pb-3 z-10"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        {/* Top row: icon + title + hide-library pill + view toggle */}
        <div className="flex items-center gap-2 mb-3">
          <TVFreakIcon size={24} />
          <h1 className="text-xl font-bold text-[#F5F5F7] flex-1">Search</h1>
          <button
            onClick={() => setHideInLibrary(prev => !prev)}
            title={hideInLibrary ? 'Showing new only — tap to show all' : 'Hide series already in your library'}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
              hideInLibrary
                ? 'bg-[rgba(255,159,10,0.15)] border-[rgba(255,159,10,0.3)] text-[#FF9F0A]'
                : 'bg-[#1C1C1E] border-white/8 text-[#48484A]'
            }`}
          >
            New only
          </button>
          <div className="flex items-center gap-0.5 bg-white/5 rounded-xl p-0.5">
            {([['big', Grid2X2], ['small', Grid3X3], ['list', List]] as const).map(([mode, Icon]) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={viewToggleClasses(mode)}>
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* TV Shows / Films toggle */}
        <div className="flex bg-[#1C1C1E] rounded-[10px] p-0.5 mb-3">
          {(['tv', 'movie'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => switchMediaMode(mode)}
              className={`flex-1 py-1.5 rounded-[8px] text-xs font-semibold transition-colors ${
                mediaMode === mode ? 'bg-[#2C2C2E] text-[#F5F5F7]' : 'text-[#48484A]'
              }`}
            >
              {mode === 'tv' ? 'TV Shows' : 'Films'}
            </button>
          ))}
        </div>

        {/* Search bar — hero element */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#1C1C1E] border border-white/8 focus-within:border-white/20 transition-colors mb-3">
          {searching && query.trim() ? (
            <Loader2 className="w-5 h-5 text-[#48484A] shrink-0 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-[#48484A] shrink-0" />
          )}
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search TMDB for a series..."
            style={{ fontSize: 16 }}
            className="flex-1 bg-transparent text-[#F5F5F7] placeholder:text-[#48484A] outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="shrink-0">
              <X className="w-4 h-4 text-[#48484A]" />
            </button>
          )}
        </div>

        {/* Genre chips */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {genres.map(g => {
            const isIncluded = includedGenres.includes(g.id)
            const isExcluded = excludedGenres.includes(g.id)
            return (
              <button
                key={g.id}
                onClick={() => toggleGenre(g.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  isIncluded
                    ? 'bg-[#FF9F0A] text-black'
                    : isExcluded
                      ? 'bg-rose-500/15 text-rose-400'
                      : 'bg-[#2C2C2E] text-[#8E8E93] active:bg-[#383838]'
                }`}
              >
                {isExcluded ? '× ' : ''}{g.label}
              </button>
            )
          })}
        </div>

        {/* Platform provider icons — circular, icon-only */}
        {availableProviders.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pt-2.5 pb-1" style={{ scrollbarWidth: 'none' }}>
            {sortedProviders.map(p => {
              const isSelected = selectedProviders.includes(p.provider_id)
              return (
                <button
                  key={p.provider_id}
                  onClick={() => toggleProvider(p.provider_id)}
                  title={p.provider_name}
                  className={`shrink-0 w-8 h-8 rounded-xl overflow-hidden border-2 transition-all ${
                    isSelected
                      ? 'border-[#FF9F0A] opacity-100'
                      : 'border-transparent opacity-40'
                  }`}
                >
                  <img
                    src={`${IMG_BASE}/w45${p.logo_path}`}
                    alt={p.provider_name}
                    className="w-full h-full object-cover"
                  />
                </button>
              )
            })}
          </div>
        )}

        {/* Sort + year controls */}
        <div className="flex items-center gap-2 mt-2.5">
          <div className="relative flex-1">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ fontSize: 16 }}
              className="w-full bg-[#1C1C1E] border border-white/8 rounded-xl px-3 pr-7 py-1.5 text-xs text-[#8E8E93] outline-none appearance-none"
            >
              <option value="vote_average.desc">Top Rated</option>
              <option value="popularity.desc">Most Popular</option>
              <option value="first_air_date.desc">Newest First</option>
              <option value="first_air_date.asc">Oldest First</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#48484A] pointer-events-none" />
          </div>
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            style={{ fontSize: 16 }}
            className="w-24 bg-[#1C1C1E] border border-white/8 rounded-xl px-3 py-1.5 text-xs text-[#8E8E93] outline-none appearance-none"
          >
            <option value="">Any year</option>
            {Array.from({ length: 2027 - 1950 + 1 }, (_, i) => 2027 - i).map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain min-h-0">

        {/* Trending section (only when no filters active) */}
        {showTrending && (
          <div className="px-4 pt-1 pb-2">
            <div className="flex items-center gap-1.5 mb-2.5">
              <SectionIcon className="w-3 h-3 text-[#48484A]" />
              <span className="text-[10px] text-[#48484A] uppercase tracking-widest font-semibold">{sectionLabel}</span>
              {isLoading && <Loader2 className="w-3 h-3 text-[#48484A] animate-spin shrink-0" />}
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {visibleResults.slice(0, 12).map(r => {
                const inLib = libraryIds.has(r.id)
                return (
                  <button
                    key={r.id}
                    onClick={() => mediaMode === 'tv' ? onSelect(seriesForPreview(r)) : onMovieSelect(movieForPreview(r))}
                    className="shrink-0 w-[88px] text-left active:opacity-70 transition-opacity"
                    style={newItemIds.has(r.id) ? { animation: 'fadeInUp 0.35s ease both' } : undefined}
                  >
                    <div className="w-[88px] aspect-[2/3] rounded-2xl overflow-hidden bg-[#1C1C1E] relative mb-1.5">
                      {r.poster_path ? (
                        <img src={posterUrl(r.poster_path, 'w185') ?? ''} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-2">
                          <span className="text-[9px] text-[#48484A] text-center">{r.name}</span>
                        </div>
                      )}
                      {(r.vote_average ?? 0) > 0 && (
                        <div className="absolute top-1.5 left-1.5 flex items-center px-1.5 rounded bg-black/65" style={{ height: '16px' }}>
                          <span className="text-[10px] font-medium leading-none"><span className="text-[#FF9F0A]">★</span><span className="text-white"> {r.vote_average!.toFixed(1)}</span></span>
                        </div>
                      )}
                      {inLib && (
                        <div className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded bg-[#FF8C00]/80">
                          <span className="text-[9px] text-white font-bold">✓</span>
                        </div>
                      )}
                      {!inLib && (
                        <button
                          onClick={e => { e.stopPropagation(); handleAdd(r) }}
                          disabled={addingId === r.id}
                          className="absolute bottom-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-lg bg-black/80 text-[#FF9F0A] border border-white/15 active:bg-[rgba(255,159,10,0.5)] transition-colors disabled:opacity-50"
                        >
                          {addingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-[#8E8E93] leading-tight line-clamp-2">{r.name}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Results grid (also used as the full grid when no trending) */}
        {(!showTrending || visibleResults.length > 0) && (
          <>
            {(!showTrending && sectionLabel) && (
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
                <SectionIcon className="w-3.5 h-3.5 text-[#48484A]" />
                <span className="text-[10px] text-[#48484A] uppercase tracking-widest font-semibold truncate">{sectionLabel}</span>
                {isLoading && <Loader2 className="w-3 h-3 text-[#48484A] animate-spin shrink-0" />}
              </div>
            )}

            {visibleResults.length === 0 && !isLoading ? (
              query.trim() ? (
                <div className="flex flex-col items-center justify-center h-40 text-center px-6">
                  <p className="text-sm text-[#48484A]">No results for "{query}"</p>
                </div>
              ) : null
            ) : viewMode === 'list' ? (
              <div className="pb-6">
                {visibleResults.map(r => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 px-4 border-b border-white/5"
                    style={newItemIds.has(r.id) ? { animation: 'fadeInUp 0.35s ease both' } : undefined}
                  >
                    <button
                      onClick={() => mediaMode === 'tv' ? onSelect(seriesForPreview(r)) : onMovieSelect(movieForPreview(r))}
                      className="flex items-center gap-3 flex-1 min-w-0 py-3 text-left active:opacity-70 transition-opacity"
                    >
                      <div className="w-10 h-[60px] rounded-lg shrink-0 overflow-hidden bg-[#1C1C1E]">
                        {r.poster_path && (
                          <img src={posterUrl(r.poster_path, 'w185') ?? ''} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#F5F5F7] leading-snug truncate">{r.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-[#48484A]">{r.first_air_date ? r.first_air_date.slice(0, 4) : 'Unknown year'}</p>
                          {(r.vote_average ?? 0) > 0 && (
                            <span className="text-xs"><span className="text-[#FF9F0A]">★</span><span className="text-[#8E8E93]"> {r.vote_average!.toFixed(1)}</span></span>
                          )}
                        </div>
                      </div>
                    </button>
                    <AddButton r={r} />
                  </div>
                ))}
              </div>
            ) : (
              <div className={`px-4 ${showTrending ? 'pt-1' : 'pt-2'} pb-6 grid gap-2.5 ${viewMode === 'big' ? 'grid-cols-2' : 'grid-cols-3 sm:grid-cols-4'}`}>
                {(showTrending ? visibleResults : visibleResults).map(r => (
                  <button
                    key={r.id}
                    onClick={() => mediaMode === 'tv' ? onSelect(seriesForPreview(r)) : onMovieSelect(movieForPreview(r))}
                    className="relative text-left active:opacity-70 transition-opacity"
                    style={newItemIds.has(r.id) ? { animation: 'fadeInUp 0.35s ease both' } : undefined}
                  >
                    <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-[#1C1C1E] relative">
                      {r.poster_path ? (
                        <img src={posterUrl(r.poster_path, 'w342') ?? ''} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-2">
                          <span className="text-[10px] text-[#48484A] text-center">{r.name}</span>
                        </div>
                      )}
                      {(r.vote_average ?? 0) > 0 && (
                        <div className="absolute top-1.5 left-1.5 flex items-center px-1.5 rounded bg-black/65" style={{ height: '16px' }}>
                          <span className="text-[10px] font-medium leading-none"><span className="text-[#FF9F0A]">★</span><span className="text-white"> {r.vote_average!.toFixed(1)}</span></span>
                        </div>
                      )}
                      <AddButton r={r} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {hasMore && <div ref={sentinelRef} className="h-px" />}
        {loadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 text-[#48484A] animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
