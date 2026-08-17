import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X, Plus, Loader2, TrendingUp, Sparkles, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { searchTv, getTrending, getDiscoverByGenres, getStreamingProviders, posterUrl, IMG_BASE, searchMovie, getTrendingMovies, discoverMovies, getMovieStreamingProviders } from '../lib/tmdb'
import { addSeries, addMovie } from '../lib/api'
import type { TmdbSearchResult, Series, Movie, WatchProvider } from '../types'
import type { ViewMode } from '../lib/useViewMode'
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

function deduped(items: TmdbSearchResult[]): TmdbSearchResult[] {
  const seen = new Set<number>()
  return items.filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
}

interface Props {
  onSeriesAdded: () => void
  allSeries: Series[]
  onSelect: (series: Series) => void
  allMovies: Movie[]
  onMovieAdded: () => void
  onMovieSelect: (movie: Movie) => void
  viewMode: ViewMode
}

export function SearchTab({ onSeriesAdded, allSeries, onSelect, allMovies, onMovieAdded, onMovieSelect, viewMode }: Props) {
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
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [trendingPage, setTrendingPage] = useState(1)
  const [trendingTotalPages, setTrendingTotalPages] = useState(1)
  const [availableProviders, setAvailableProviders] = useState<WatchProvider[]>([])
  const [selectedProviders, setSelectedProviders] = useState<number[]>(getDefaultProviders)
  const [hideInLibrary, setHideInLibrary] = useState(false)
  const [newItemIds, setNewItemIds] = useState<Set<number>>(new Set())
  const [mediaMode, setMediaMode] = useState<'tv' | 'movie'>('tv')
  const [showFilterSheet, setShowFilterSheet] = useState(false)
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
    scrollRef.current?.scrollTo({ top: 0 })
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
      setTrending(applySort(deduped([...p1.results, ...p2.results])))
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
      scrollRef.current?.scrollTo({ top: 0 })
      const year = yearFilter.length === 4 ? yearFilter : undefined
      try {
        if (mediaMode === 'tv') {
          if (hasQuery) {
            const [p1, p2] = await Promise.all([searchTv(query, 1, year), searchTv(query, 2, year)])
            setResults(applySort(deduped([...p1.results, ...p2.results])))
            setTotalPages(p1.totalPages)
            setCurrentPage(Math.min(2, p1.totalPages))
          } else {
            const [p1, p2] = await Promise.all([
              getDiscoverByGenres(includedGenres, excludedGenres, 1, sortBy, year, selectedProviders, getCountry()),
              getDiscoverByGenres(includedGenres, excludedGenres, 2, sortBy, year, selectedProviders, getCountry()),
            ])
            setResults(applySort(deduped([...p1.results, ...p2.results])))
            setTotalPages(p1.totalPages)
            setCurrentPage(Math.min(2, p1.totalPages))
          }
        } else {
          if (hasQuery) {
            const [p1, p2] = await Promise.all([searchMovie(query, 1, year), searchMovie(query, 2, year)])
            setResults(applySort(deduped([...p1.results, ...p2.results])))
            setTotalPages(p1.totalPages)
            setCurrentPage(Math.min(2, p1.totalPages))
          } else {
            const [p1, p2] = await Promise.all([
              discoverMovies(includedGenres, excludedGenres, 1, sortBy, year, selectedProviders, getCountry()),
              discoverMovies(includedGenres, excludedGenres, 2, sortBy, year, selectedProviders, getCountry()),
            ])
            setResults(applySort(deduped([...p1.results, ...p2.results])))
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
        setTrending(prev => deduped([...prev, ...freshItems]))
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
          setResults(prev => deduped([...prev, ...freshItems]))
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
          setResults(prev => deduped([...prev, ...freshItems]))
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

  const displayResults = showTrending ? trending : results
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

  const activeFilterCount = [
    includedGenres.length > 0 || excludedGenres.length > 0,
    selectedProviders.length > 0,
    yearFilter.length === 4,
    hideInLibrary,
  ].filter(Boolean).length

  function clearFilters() {
    setIncludedGenres([])
    setExcludedGenres([])
    setSelectedProviders([])
    setYearFilter('')
    setHideInLibrary(false)
  }

  function AddButton({ r }: { r: TmdbSearchResult }) {
    const inLib = libraryIds.has(r.id)
    if (inLib) {
      return (
        <div className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded bg-[#BF5AF2]/80">
          <span className="text-[9px] text-white font-bold">✓</span>
        </div>
      )
    }
    return (
      <button
        onClick={e => { e.stopPropagation(); handleAdd(r) }}
        disabled={addingId === r.id}
        className="absolute bottom-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-lg bg-black/80 text-[#BF5AF2] border border-white/15 active:bg-[rgba(191,90,242,0.5)] transition-colors disabled:opacity-50"
      >
        {addingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full bg-black">

      {/* Sticky header — single row */}
      <div className="shrink-0 bg-black z-10">
        <div className="flex items-center gap-2 px-4 pt-2 pb-3">

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
          <div className="flex-1 flex items-center bg-[#1C1C1E] rounded-xl border border-white/8 focus-within:border-white/20 transition-colors pl-3 pr-2 gap-2 min-w-0">
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
              className="flex-1 bg-transparent text-[#F5F5F7] placeholder:text-[#48484A] outline-none py-[5px] min-w-0"
            />
            {query && (
              <button onClick={() => setQuery('')} className="shrink-0 p-1">
                <X className="w-3.5 h-3.5 text-[#48484A]" />
              </button>
            )}
          </div>

          {/* Filters icon button */}
          <button
            onClick={() => setShowFilterSheet(true)}
            className={`relative shrink-0 w-8 h-8 flex items-center justify-center rounded-xl border transition-colors ${
              activeFilterCount > 0
                ? 'bg-[rgba(191,90,242,0.12)] border-[rgba(191,90,242,0.35)] text-[#BF5AF2]'
                : 'bg-[#1C1C1E] border-white/8 text-[#8E8E93]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#BF5AF2] text-white text-[9px] font-bold min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain min-h-0">

        {/* Trending section (only when no filters active) */}
        {showTrending && (
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <SectionIcon className="w-5 h-5 text-[#BF5AF2] shrink-0" />
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
                          <span className="text-[10px] font-medium leading-none"><span className="text-[#BF5AF2]">★</span><span className="text-white"> {r.vote_average!.toFixed(1)}</span></span>
                        </div>
                      )}
                      {inLib && (
                        <div className="absolute bottom-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded bg-[#BF5AF2]/80">
                          <span className="text-[9px] text-white font-bold">✓</span>
                        </div>
                      )}
                      {!inLib && (
                        <button
                          onClick={e => { e.stopPropagation(); handleAdd(r) }}
                          disabled={addingId === r.id}
                          className="absolute bottom-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-lg bg-black/80 text-[#BF5AF2] border border-white/15 active:bg-[rgba(191,90,242,0.5)] transition-colors disabled:opacity-50"
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
                <SectionIcon className="w-4.5 h-4.5 text-[#BF5AF2] shrink-0" />
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
                            <span className="text-xs"><span className="text-[#BF5AF2]">★</span><span className="text-[#8E8E93]"> {r.vote_average!.toFixed(1)}</span></span>
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
                          <span className="text-[10px] font-medium leading-none"><span className="text-[#BF5AF2]">★</span><span className="text-white"> {r.vote_average!.toFixed(1)}</span></span>
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

      {/* Unified filter sheet */}
      {showFilterSheet && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowFilterSheet(false)} />
          <div
            className="fixed left-0 right-0 bottom-0 z-40 bg-[#1C1C1E] rounded-t-2xl shadow-2xl border-t border-white/8 overflow-y-auto"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)', maxHeight: '85vh' }}
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#1C1C1E] flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/6 z-10">
              <span className="text-sm font-semibold text-[#F5F5F7]">Filters</span>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-[#BF5AF2] font-medium">
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setShowFilterSheet(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white/8"
                >
                  <X className="w-3.5 h-3.5 text-[#8E8E93]" />
                </button>
              </div>
            </div>

            {/* Sort by */}
            <div className="px-4 pt-4 pb-4">
              <p className="text-[11px] font-semibold text-[#48484A] uppercase tracking-wide mb-2.5">Sort by</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'vote_average.desc', label: 'Top Rated' },
                  { value: 'popularity.desc', label: 'Popular' },
                  { value: 'first_air_date.desc', label: 'Newest' },
                  { value: 'first_air_date.asc', label: 'Oldest' },
                ] as const).map(o => (
                  <button
                    key={o.value}
                    onClick={() => setSortBy(o.value)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      sortBy === o.value ? 'bg-[#BF5AF2] text-white' : 'bg-[#2C2C2E] text-[#8E8E93] active:bg-[#383838]'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Genre */}
            <div className="px-4 pt-2 pb-4 border-t border-white/6">
              <p className="text-[11px] font-semibold text-[#48484A] uppercase tracking-wide mb-2.5">Genre</p>
              <div className="flex flex-wrap gap-2">
                {genres.map(g => {
                  const isIncluded = includedGenres.includes(g.id)
                  const isExcluded = excludedGenres.includes(g.id)
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleGenre(g.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                        isIncluded
                          ? 'bg-[rgba(191,90,242,0.12)] border-[rgba(191,90,242,0.4)] text-[#BF5AF2]'
                          : isExcluded
                          ? 'bg-[rgba(251,113,133,0.12)] border-[rgba(251,113,133,0.4)] text-[#FB7185]'
                          : 'bg-[#2C2C2E] border-transparent text-[#8E8E93] active:bg-[#383838]'
                      }`}
                    >
                      {isIncluded ? '✓ ' : isExcluded ? '✕ ' : ''}{g.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-[#48484A] mt-2.5">Tap once to include · tap again to exclude · tap again to clear</p>
            </div>

            {/* Year */}
            <div className="px-4 pt-2 pb-4 border-t border-white/6 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[#48484A] uppercase tracking-wide">Year</p>
              <div className="relative">
                <select
                  value={yearFilter}
                  onChange={e => setYearFilter(e.target.value)}
                  className={`appearance-none bg-[#2C2C2E] border rounded-lg pl-3 pr-7 py-2 text-xs font-medium outline-none transition-colors ${
                    yearFilter ? 'border-[rgba(191,90,242,0.4)] text-[#BF5AF2]' : 'border-white/8 text-[#8E8E93]'
                  }`}
                >
                  <option value="" className="bg-[#111111]">Any year</option>
                  {Array.from({ length: 2027 - 1950 + 1 }, (_, i) => 2027 - i).map(y => (
                    <option key={y} value={String(y)} className="bg-[#111111]">{y}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#48484A] pointer-events-none" />
              </div>
            </div>

            {/* New only */}
            <div className="px-4 pt-2 pb-4 border-t border-white/6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[#F5F5F7]">New only</p>
                <p className="text-[11px] text-[#48484A] mt-0.5">Hide titles already in your library</p>
              </div>
              <button
                onClick={() => setHideInLibrary(prev => !prev)}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${hideInLibrary ? 'bg-[#BF5AF2]' : 'bg-[#2C2C2E]'}`}
              >
                <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow transition-all ${hideInLibrary ? 'left-[22px]' : 'left-[3px]'}`} />
              </button>
            </div>

            {/* Platforms */}
            {availableProviders.length > 0 && (
              <div className="px-4 pt-2 pb-4 border-t border-white/6">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] font-semibold text-[#48484A] uppercase tracking-wide">Platforms</p>
                  {selectedProviders.length > 0 && (
                    <button onClick={() => setSelectedProviders([])} className="text-[11px] text-[#BF5AF2] font-medium">
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {sortedProviders.map(p => {
                    const isSelected = selectedProviders.includes(p.provider_id)
                    return (
                      <button
                        key={p.provider_id}
                        onClick={() => toggleProvider(p.provider_id)}
                        className="flex flex-col items-center gap-1 transition-all active:opacity-70"
                      >
                        <div className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                          isSelected ? 'border-[#BF5AF2]' : 'border-transparent opacity-40'
                        }`}>
                          <img src={`${IMG_BASE}/w92${p.logo_path}`} alt={p.provider_name} className="w-full h-full object-cover" />
                        </div>
                        <span className={`text-[9px] text-center leading-tight max-w-[52px] truncate ${
                          isSelected ? 'text-[#BF5AF2]' : 'text-[#48484A]'
                        }`}>
                          {p.provider_name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
