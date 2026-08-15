import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Plus, Loader2, TrendingUp, Sparkles, Grid2X2, Grid3X3, List, ChevronDown } from 'lucide-react'
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
  const [showPlatformPicker, setShowPlatformPicker] = useState(false)
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

      {/* Sticky header — 2 rows */}
      <div className="shrink-0 bg-black z-10">

        {/* Row 1: Icon + TV/Films + Search */}
        <div
          className="flex items-center gap-2 px-4 pb-2"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
        >
          <TVFreakIcon size={22} className="shrink-0" />
          {/* TV / Films segment */}
          <div className="flex bg-[#1C1C1E] rounded-lg p-0.5 shrink-0">
            {(['tv', 'movie'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => switchMediaMode(mode)}
                className={`px-3 py-[5px] rounded-[6px] text-[11px] font-semibold transition-colors ${
                  mediaMode === mode ? 'bg-[#2C2C2E] text-[#F5F5F7]' : 'text-[#48484A]'
                }`}
              >
                {mode === 'tv' ? 'TV' : 'Films'}
              </button>
            ))}
          </div>
          {/* Search input */}
          <div className="flex-1 flex items-center bg-[#1C1C1E] rounded-xl border border-white/8 focus-within:border-white/20 transition-colors pl-3 pr-2 gap-2" style={{ minHeight: 38 }}>
            {searching && query.trim() ? (
              <Loader2 className="w-4 h-4 text-[#48484A] shrink-0 animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-[#48484A] shrink-0" />
            )}
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={mediaMode === 'tv' ? 'Search TV shows...' : 'Search films...'}
              style={{ fontSize: 15 }}
              className="flex-1 bg-transparent text-[#F5F5F7] placeholder:text-[#48484A] outline-none py-2 min-w-0"
            />
            {query && (
              <button onClick={() => setQuery('')} className="shrink-0 p-1">
                <X className="w-3.5 h-3.5 text-[#48484A]" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Filters */}
        <div className="flex items-center gap-1.5 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>

          {/* Genre select */}
          <div className="relative shrink-0">
            <select
              value={includedGenres[0]?.toString() ?? ''}
              onChange={e => {
                const val = e.target.value
                setIncludedGenres(val ? [parseInt(val)] : [])
                setExcludedGenres([])
              }}
              style={{ fontSize: 13 }}
              className={`appearance-none bg-[#1C1C1E] border rounded-lg pl-2.5 pr-6 py-[7px] text-[12px] font-medium outline-none transition-colors ${
                includedGenres.length > 0
                  ? 'border-[rgba(255,159,10,0.5)] text-[#FF9F0A]'
                  : 'border-white/8 text-[#8E8E93]'
              }`}
            >
              <option value="" className="bg-[#111111]">Genre</option>
              {genres.map(g => (
                <option key={g.id} value={String(g.id)} className="bg-[#111111] text-[#F5F5F7]">{g.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#48484A] pointer-events-none" />
          </div>

          {/* Platforms button — opens bottom sheet */}
          {availableProviders.length > 0 && (
            <button
              onClick={() => setShowPlatformPicker(true)}
              className={`shrink-0 flex items-center gap-1.5 border rounded-lg px-2.5 py-[7px] text-[12px] font-medium transition-colors ${
                selectedProviders.length > 0
                  ? 'bg-[#1C1C1E] border-[rgba(255,159,10,0.5)] text-[#FF9F0A]'
                  : 'bg-[#1C1C1E] border-white/8 text-[#8E8E93]'
              }`}
            >
              {selectedProviders.length > 0 ? (
                <>
                  {sortedProviders.filter(p => selectedProviders.includes(p.provider_id)).slice(0, 3).map(p => (
                    <img key={p.provider_id} src={`${IMG_BASE}/w45${p.logo_path}`} alt="" className="w-4 h-4 rounded object-cover" />
                  ))}
                  {selectedProviders.length > 3 && <span>+{selectedProviders.length - 3}</span>}
                </>
              ) : 'Platforms'}
              <ChevronDown className="w-3 h-3 shrink-0 text-[#48484A]" />
            </button>
          )}

          {/* Sort */}
          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ fontSize: 13 }}
              className="appearance-none bg-[#1C1C1E] border border-white/8 rounded-lg pl-2.5 pr-6 py-[7px] text-[12px] font-medium text-[#8E8E93] outline-none"
            >
              <option value="vote_average.desc" className="bg-[#111111]">Top Rated</option>
              <option value="popularity.desc" className="bg-[#111111]">Popular</option>
              <option value="first_air_date.desc" className="bg-[#111111]">Newest</option>
              <option value="first_air_date.asc" className="bg-[#111111]">Oldest</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#48484A] pointer-events-none" />
          </div>

          {/* Year */}
          <div className="relative shrink-0">
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              style={{ fontSize: 13 }}
              className={`appearance-none bg-[#1C1C1E] border rounded-lg pl-2.5 pr-6 py-[7px] text-[12px] font-medium outline-none transition-colors ${
                yearFilter ? 'border-[rgba(255,159,10,0.5)] text-[#FF9F0A]' : 'border-white/8 text-[#8E8E93]'
              }`}
            >
              <option value="" className="bg-[#111111]">Year</option>
              {Array.from({ length: 2027 - 1950 + 1 }, (_, i) => 2027 - i).map(y => (
                <option key={y} value={String(y)} className="bg-[#111111]">{y}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#48484A] pointer-events-none" />
          </div>

          {/* New only */}
          <button
            onClick={() => setHideInLibrary(prev => !prev)}
            className={`shrink-0 border rounded-lg px-2.5 py-[7px] text-[12px] font-medium transition-colors ${
              hideInLibrary
                ? 'bg-[rgba(255,159,10,0.12)] border-[rgba(255,159,10,0.35)] text-[#FF9F0A]'
                : 'bg-[#1C1C1E] border-white/8 text-[#8E8E93]'
            }`}
          >
            New
          </button>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5 ml-auto shrink-0">
            {([['big', Grid2X2], ['small', Grid3X3], ['list', List]] as const).map(([mode, Icon]) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={viewToggleClasses(mode)}>
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain min-h-0">

        {/* Trending section (only when no filters active) */}
        {showTrending && (
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <SectionIcon className="w-5 h-5 text-[#FF9F0A] shrink-0" />
              <h2 className="text-base font-bold text-[#F5F5F7] flex-1">{sectionLabel}</h2>
              {isLoading && <Loader2 className="w-4 h-4 text-[#48484A] animate-spin shrink-0" />}
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
                    <div className="w-[88px] aspect-[2/3] rounded-2xl overflow-hidden bg-[#1C1C1E] relative">
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
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <SectionIcon className="w-4.5 h-4.5 text-[#FF9F0A] shrink-0" />
                <h2 className="text-sm font-bold text-[#F5F5F7] flex-1 truncate">{sectionLabel}</h2>
                {isLoading && <Loader2 className="w-3.5 h-3.5 text-[#48484A] animate-spin shrink-0" />}
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

      {/* Platform picker — bottom sheet */}
      {showPlatformPicker && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowPlatformPicker(false)} />
          <div
            className="fixed left-0 right-0 bottom-0 z-40 bg-[#1C1C1E] rounded-t-2xl shadow-2xl border-t border-white/8"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <span className="text-sm font-semibold text-[#F5F5F7]">Platforms</span>
              <div className="flex items-center gap-3">
                {selectedProviders.length > 0 && (
                  <button
                    onClick={() => setSelectedProviders([])}
                    className="text-xs text-[#FF9F0A] font-medium"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setShowPlatformPicker(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white/8"
                >
                  <X className="w-3.5 h-3.5 text-[#8E8E93]" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 px-4 pb-4">
              {sortedProviders.map(p => {
                const isSelected = selectedProviders.includes(p.provider_id)
                return (
                  <button
                    key={p.provider_id}
                    onClick={() => toggleProvider(p.provider_id)}
                    className="flex flex-col items-center gap-1 transition-all active:opacity-70"
                  >
                    <div className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                      isSelected ? 'border-[#FF9F0A]' : 'border-transparent opacity-40'
                    }`}>
                      <img
                        src={`${IMG_BASE}/w92${p.logo_path}`}
                        alt={p.provider_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className={`text-[9px] text-center leading-tight max-w-[52px] truncate ${
                      isSelected ? 'text-[#FF9F0A]' : 'text-[#48484A]'
                    }`}>
                      {p.provider_name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
