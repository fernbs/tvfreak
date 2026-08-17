import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { X, Check, Loader2, ChevronLeft, Sparkles } from 'lucide-react'
import { getDiscoverByGenres, discoverMovies, getNowPlayingMovieIds, getStreamingProviders, getMovieStreamingProviders, posterUrl, IMG_BASE } from '../lib/tmdb'
import { getDefaultProviders, getCountry } from '../lib/settings'
import { addSeries, addMovie } from '../lib/api'
import type { TmdbSearchResult, Series, Movie, WatchProvider } from '../types'
import { toast } from 'sonner'

// ── Genre lists matching SearchTab ──────────────────────────────────────────

const TV_GENRES = [
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

const MOVIE_GENRES = [
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

const RATING_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Any', value: null },
  { label: '5+', value: 5 },
  { label: '6+', value: 6 },
  { label: '7+', value: 7 },
  { label: '7.5+', value: 7.5 },
  { label: '8+', value: 8 },
]

type GenreState = 'neutral' | 'include' | 'exclude'

interface Props {
  allSeries: Series[]
  allMovies: Movie[]
  onSeriesAdded: () => void
  onMovieAdded: () => void
}

// ── Swipe card ──────────────────────────────────────────────────────────────

interface SwipeCardProps {
  card: TmdbSearchResult
  isTop: boolean
  stackIndex: number
  inCinema: boolean
  onDecide: (dir: 'left' | 'right') => void
  onReady?: (flyOut: (dir: 'left' | 'right') => void) => void
}

function SwipeCard({ card, isTop, stackIndex, inCinema, onDecide, onReady }: SwipeCardProps) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-260, 260], [-14, 14])
  const likeOpacity = useTransform(x, [30, 110], [0, 1])
  const skipOpacity = useTransform(x, [-110, -30], [1, 0])
  const poster = posterUrl(card.poster_path, 'w500')

  const onDecideRef = useRef(onDecide)
  onDecideRef.current = onDecide

  async function flyOut(dir: 'left' | 'right') {
    await animate(x, dir === 'right' ? 620 : -620, {
      type: 'tween', duration: 0.26, ease: 'easeOut',
    })
    onDecideRef.current(dir)
  }

  useEffect(() => {
    if (isTop) onReady?.(flyOut)
  }, [isTop])

  function onDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    if (info.offset.x > 80 || info.velocity.x > 500) flyOut('right')
    else if (info.offset.x < -80 || info.velocity.x < -500) flyOut('left')
  }

  return (
    <motion.div
      className="absolute inset-0 rounded-3xl overflow-hidden select-none"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        zIndex: 10 - stackIndex,
        cursor: isTop ? 'grab' : 'default',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}
      animate={{ y: stackIndex * 10, scale: 1 - stackIndex * 0.045 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.75}
      onDragEnd={isTop ? onDragEnd : undefined}
      whileDrag={{ cursor: 'grabbing' }}
    >
      {poster ? (
        <img src={poster} alt={card.name} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="w-full h-full bg-[#1C1C1E] flex items-center justify-center p-8">
          <span className="text-[#8E8E93] text-center text-sm leading-relaxed">{card.name}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-5 pb-7">
        <h2 className="text-[22px] font-bold text-white leading-tight mb-2">{card.name}</h2>
        <div className="flex items-center flex-wrap gap-2 mb-2.5">
          {card.first_air_date && (
            <span className="text-sm text-[#8E8E93]">{card.first_air_date.slice(0, 4)}</span>
          )}
          {(card.vote_average ?? 0) > 0 && (
            <span className="text-sm font-medium">
              <span className="text-[#BF5AF2]">★</span>
              <span className="text-white"> {card.vote_average!.toFixed(1)}</span>
            </span>
          )}
          {inCinema && (
            <span className="text-[10px] font-semibold py-0.5 px-2 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              In cinema
            </span>
          )}
        </div>
        {card.overview && (
          <p className="text-[13px] text-[#8E8E93]/75 line-clamp-2 leading-relaxed">{card.overview}</p>
        )}
      </div>
      {isTop && (
        <motion.div className="absolute inset-0 rounded-3xl" style={{ opacity: likeOpacity }}>
          <div className="absolute inset-0 rounded-3xl border-[3px] border-emerald-400 bg-emerald-500/10" />
          <div className="absolute top-5 right-5 bg-emerald-400 rounded-2xl px-3 py-2 flex items-center gap-1.5">
            <Check className="w-5 h-5 text-white" strokeWidth={2.5} />
            <span className="text-white text-sm font-bold tracking-wide">Add</span>
          </div>
        </motion.div>
      )}
      {isTop && (
        <motion.div className="absolute inset-0 rounded-3xl" style={{ opacity: skipOpacity }}>
          <div className="absolute inset-0 rounded-3xl border-[3px] border-rose-400 bg-rose-500/10" />
          <div className="absolute top-5 left-5 bg-rose-400 rounded-2xl px-3 py-2 flex items-center gap-1.5">
            <X className="w-5 h-5 text-white" strokeWidth={2.5} />
            <span className="text-white text-sm font-bold tracking-wide">Skip</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] text-[#48484A] uppercase tracking-widest font-semibold mb-2">
      {children}
    </p>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function DiscoverTab({ allSeries, allMovies, onSeriesAdded, onMovieAdded }: Props) {
  const [phase, setPhase] = useState<'setup' | 'swiping'>('setup')
  const [mediaMode, setMediaMode] = useState<'tv' | 'movie'>('tv')
  const [genreStates, setGenreStates] = useState<Record<number, GenreState>>({})
  const [minRating, setMinRating] = useState<number | null>(null)
  const [yearFilter, setYearFilter] = useState('')
  const [newOnly, setNewOnly] = useState(false)

  // Provider state (per-session, pre-seeded from settings defaults)
  const [availableProviders, setAvailableProviders] = useState<WatchProvider[]>([])
  const [selectedProviders, setSelectedProviders] = useState<number[]>(() => getDefaultProviders())
  const [loadingProviders, setLoadingProviders] = useState(false)

  // Queue-based swiping
  const [queue, setQueue] = useState<TmdbSearchResult[]>([])
  const [seen, setSeen] = useState(0)
  const [fetching, setFetching] = useState(false)
  const [nowPlayingIds, setNowPlayingIds] = useState<Set<number>>(new Set())

  // Refs for async closures
  const fetchPageRef = useRef(3)
  const maxPageRef = useRef(99)
  const fetchingRef = useRef(false)
  const activeModeRef = useRef<'tv' | 'movie'>('tv')
  const activeIncludedRef = useRef<number[]>([])
  const activeExcludedRef = useRef<number[]>([])
  const activeProvidersRef = useRef<number[]>([])
  const activeRegionRef = useRef<string>('')
  const activeMinRatingRef = useRef<number | null>(null)
  const activeYearRef = useRef<string>('')
  const newOnlyRef = useRef(false)
  const seenIds = useRef(new Set<number>())
  const libraryIdsRef = useRef(new Set<number>())
  const topCardFlyOut = useRef<((dir: 'left' | 'right') => void) | null>(null)

  const genres = mediaMode === 'tv' ? TV_GENRES : MOVIE_GENRES

  const includedGenres = useMemo(
    () => genres.filter(g => genreStates[g.id] === 'include').map(g => g.id),
    [genres, genreStates]
  )
  const excludedGenres = useMemo(
    () => genres.filter(g => genreStates[g.id] === 'exclude').map(g => g.id),
    [genres, genreStates]
  )

  // Load providers when mediaMode or country changes (setup phase only)
  useEffect(() => {
    if (phase !== 'setup') return
    const country = getCountry()
    setLoadingProviders(true)
    const fetchFn = mediaMode === 'tv' ? getStreamingProviders : getMovieStreamingProviders
    fetchFn(country)
      .then(providers => {
        setAvailableProviders(providers)
        // Pre-select only providers that are available in this mode
        const available = new Set(providers.map(p => p.provider_id))
        setSelectedProviders(prev => prev.filter(id => available.has(id)))
      })
      .finally(() => setLoadingProviders(false))
  }, [mediaMode, phase])

  // Keep library ID ref current
  useEffect(() => {
    const mode = activeModeRef.current
    libraryIdsRef.current = new Set(
      (mode === 'tv' ? allSeries : allMovies).map(x => x.tmdbId).filter(Boolean) as number[]
    )
  }, [allSeries, allMovies])

  const topCard = queue[0] ?? null
  const isEmpty = !topCard && !fetching

  function filterFresh(results: TmdbSearchResult[]): TmdbSearchResult[] {
    return results.filter(r => {
      if (!r.poster_path || seenIds.current.has(r.id)) return false
      if (newOnlyRef.current && libraryIdsRef.current.has(r.id)) return false
      seenIds.current.add(r.id)
      return true
    })
  }

  function makeFetchArgs(page: number) {
    return [
      activeIncludedRef.current,
      activeExcludedRef.current,
      page,
      'vote_average.desc',
      activeYearRef.current || undefined,
      activeProvidersRef.current,
      activeRegionRef.current,
      activeMinRatingRef.current ?? undefined,
    ] as const
  }

  async function fetchBatch(page: number): Promise<void> {
    if (fetchingRef.current || page > maxPageRef.current) return
    fetchingRef.current = true
    setFetching(true)
    try {
      const mode = activeModeRef.current
      const fetchFn = mode === 'tv' ? getDiscoverByGenres : discoverMovies
      const p2 = Math.min(page + 1, maxPageRef.current)
      const fetches = page < p2
        ? [fetchFn(...makeFetchArgs(page)), fetchFn(...makeFetchArgs(p2))]
        : [fetchFn(...makeFetchArgs(page))]
      const results = await Promise.all(fetches)
      maxPageRef.current = results[0].totalPages
      fetchPageRef.current = (page < p2 ? p2 : page) + 1
      const fresh = filterFresh(results.flatMap(r => r.results))
      setQueue(prev => [...prev, ...fresh])
    } finally {
      fetchingRef.current = false
      setFetching(false)
    }
  }

  useEffect(() => {
    if (phase !== 'swiping' || fetchingRef.current) return
    if (queue.length < 6 && fetchPageRef.current <= maxPageRef.current) {
      fetchBatch(fetchPageRef.current)
    }
  }, [queue.length, phase])

  async function handleStart() {
    if (includedGenres.length === 0) return
    const region = getCountry()

    activeModeRef.current = mediaMode
    activeIncludedRef.current = includedGenres
    activeExcludedRef.current = excludedGenres
    activeProvidersRef.current = selectedProviders
    activeRegionRef.current = region
    activeMinRatingRef.current = minRating
    activeYearRef.current = yearFilter.length === 4 ? yearFilter : ''
    newOnlyRef.current = newOnly

    seenIds.current = new Set()
    fetchPageRef.current = 3
    maxPageRef.current = 99
    libraryIdsRef.current = new Set(
      (mediaMode === 'tv' ? allSeries : allMovies).map(x => x.tmdbId).filter(Boolean) as number[]
    )
    setQueue([])
    setSeen(0)
    setNowPlayingIds(new Set())
    setPhase('swiping')

    setFetching(true)
    fetchingRef.current = true
    try {
      const fetchFn = mediaMode === 'tv' ? getDiscoverByGenres : discoverMovies
      const [p1, p2] = await Promise.all([
        fetchFn(...makeFetchArgs(1)),
        fetchFn(...makeFetchArgs(2)),
      ])
      maxPageRef.current = p1.totalPages
      setQueue(filterFresh([...p1.results, ...p2.results]))
      if (mediaMode === 'movie' && selectedProviders.length === 0) {
        getNowPlayingMovieIds(region).then(setNowPlayingIds)
      }
    } finally {
      fetchingRef.current = false
      setFetching(false)
    }
  }

  async function handleDecide(dir: 'left' | 'right') {
    const card = queue[0]
    if (!card) return
    setQueue(prev => prev.slice(1))
    setSeen(s => s + 1)
    topCardFlyOut.current = null

    if (dir === 'right') {
      if (libraryIdsRef.current.has(card.id)) {
        toast('Already in your library')
      } else {
        try {
          if (activeModeRef.current === 'tv') {
            await addSeries({
              tmdbId: card.id, title: card.name, status: 'plantowatch',
              posterPath: card.poster_path ?? null, overview: card.overview ?? null,
              firstAirDate: card.first_air_date ?? null, lastAirDate: null,
              numberOfSeasons: null, notes: '', nextEpisodeDate: null, nextEpisodeName: null,
              imdbRating: (card.vote_average ?? 0) > 0 ? card.vote_average!.toFixed(1) : null,
              futureDates: null, addedAt: new Date(), updatedAt: new Date(),
            })
            toast.success(`"${card.name}" added to library`)
            onSeriesAdded()
          } else {
            await addMovie({
              tmdbId: card.id, title: card.name, status: 'plantowatch',
              posterPath: card.poster_path ?? null, overview: card.overview ?? null,
              releaseDate: card.first_air_date ?? null, runtime: null, notes: '',
              imdbRating: (card.vote_average ?? 0) > 0 ? card.vote_average!.toFixed(1) : null,
              addedAt: new Date(), updatedAt: new Date(),
            })
            toast.success(`"${card.name}" added to watchlist`)
            onMovieAdded()
          }
        } catch {
          toast.error('Could not add — try again')
        }
      }
    }
  }

  function toggleGenre(id: number) {
    setGenreStates(prev => {
      const current = prev[id] ?? 'neutral'
      const next: GenreState = current === 'neutral' ? 'include' : current === 'include' ? 'exclude' : 'neutral'
      if (next === 'neutral') {
        const { [id]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: next }
    })
  }

  function chipClass(id: number): string {
    const state = genreStates[id] ?? 'neutral'
    if (state === 'include') return 'bg-[#BF5AF2] text-white border border-[#BF5AF2]'
    if (state === 'exclude') return 'bg-rose-500/15 text-rose-400 border border-rose-500/35'
    return 'bg-[#1C1C1E] text-[#8E8E93] border border-white/8 active:bg-[#2C2C2E]'
  }

  function toggleProvider(id: number) {
    setSelectedProviders(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  // ── Setup screen ─────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="flex flex-col h-full bg-black">
        {/* TV / Movie toggle */}
        <div className="shrink-0 px-4 pb-3 pt-2 bg-black">
          <div className="flex bg-white/5 rounded-2xl p-1 gap-1">
            {(['tv', 'movie'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => { setMediaMode(mode); setGenreStates({}) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  mediaMode === mode ? 'bg-[#1C1C1E] text-[#F5F5F7] shadow' : 'text-[#48484A]'
                }`}
              >
                {mode === 'tv' ? 'TV Series' : 'Films'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">

          {/* Genres */}
          <div>
            <SectionLabel>Genres</SectionLabel>
            <p className="text-[11px] text-[#48484A] mb-3">Tap once to include, twice to exclude.</p>
            <div className="flex flex-wrap gap-2">
              {genres.map(g => {
                const state = genreStates[g.id] ?? 'neutral'
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleGenre(g.id)}
                    className={`flex items-center gap-1 py-1.5 px-3.5 rounded-full text-[11px] font-semibold transition-colors ${chipClass(g.id)}`}
                  >
                    {state === 'exclude' && <X className="w-3 h-3 shrink-0" strokeWidth={2.5} />}
                    <span className={state === 'exclude' ? 'line-through' : ''}>{g.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Rating */}
          <div>
            <SectionLabel>Min rating</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {RATING_OPTIONS.map(opt => (
                <button
                  key={String(opt.value)}
                  onClick={() => setMinRating(opt.value)}
                  className={`py-1.5 px-3.5 rounded-full text-[11px] font-semibold transition-colors border ${
                    minRating === opt.value
                      ? 'bg-[#BF5AF2] text-white border-[#BF5AF2]'
                      : 'bg-[#1C1C1E] text-[#8E8E93] border-white/8 active:bg-[#2C2C2E]'
                  }`}
                >
                  {opt.value == null ? 'Any' : <><span className="text-[10px]">★</span> {opt.label}</>}
                </button>
              ))}
            </div>
          </div>

          {/* Year */}
          <div>
            <SectionLabel>Year</SectionLabel>
            <input
              type="number"
              inputMode="numeric"
              placeholder="e.g. 2022"
              min={1900}
              max={new Date().getFullYear() + 2}
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value.slice(0, 4))}
              className="w-full bg-[#1C1C1E] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-[#F5F5F7] placeholder-[#48484A] outline-none focus:border-white/20 transition-colors"
              style={{ fontSize: 16 }}
            />
          </div>

          {/* Library toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#F5F5F7]">New only</p>
              <p className="text-[11px] text-[#48484A] mt-0.5">Hide titles already in your library</p>
            </div>
            <button
              onClick={() => setNewOnly(v => !v)}
              className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${newOnly ? 'bg-[#BF5AF2]' : 'bg-[#2C2C2E]'}`}
            >
              <span className={`absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white shadow transition-all ${newOnly ? 'left-[22px]' : 'left-[3px]'}`} />
            </button>
          </div>

          {/* Platforms */}
          <div>
            <SectionLabel>Platforms</SectionLabel>
            {loadingProviders ? (
              <Loader2 className="w-4 h-4 text-[#48484A] animate-spin" />
            ) : availableProviders.length === 0 ? (
              <p className="text-[11px] text-[#48484A]">No platforms found for your region. Update in Settings.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableProviders.map(p => {
                  const isSelected = selectedProviders.includes(p.provider_id)
                  return (
                    <button
                      key={p.provider_id}
                      onClick={() => toggleProvider(p.provider_id)}
                      title={p.provider_name}
                      className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1.5 rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-[rgba(191,90,242,0.15)] border-[rgba(191,90,242,0.35)] text-[#F5F5F7]'
                          : 'bg-[#1C1C1E] border-white/8 text-[#48484A] active:bg-[#2C2C2E]'
                      }`}
                    >
                      <img
                        src={`${IMG_BASE}/w45${p.logo_path}`}
                        alt={p.provider_name}
                        className="w-5 h-5 rounded-sm object-cover shrink-0"
                      />
                      <span className="text-[11px] font-medium whitespace-nowrap">{p.provider_name}</span>
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-[11px] text-[#48484A] mt-2 leading-relaxed">
              {selectedProviders.length === 0
                ? 'No platform selected — showing everything, including cinema releases.'
                : `${selectedProviders.length} platform${selectedProviders.length > 1 ? 's' : ''} selected.`}
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={handleStart}
            disabled={includedGenres.length === 0}
            className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-25"
            style={{
              background: 'linear-gradient(180deg, #BF5AF2 0%, #A63FD9 100%)',
              boxShadow: includedGenres.length > 0 ? '0 4px 24px rgba(191,90,242,0.4)' : 'none',
            }}
          >
            <Sparkles className="w-4 h-4" />
            Let's go
          </button>
        </div>
      </div>
    )
  }

  // ── Swiping screen ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="shrink-0 flex items-center justify-between px-4 py-2">
        <button
          onClick={() => setPhase('setup')}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#1C1C1E] border border-white/8 text-[#8E8E93]"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          {seen > 0 && (
            <span className="text-[11px] text-[#48484A] font-medium">{seen} seen</span>
          )}
          {fetching && <Loader2 className="w-3.5 h-3.5 text-[#48484A] animate-spin" />}
        </div>
        <div className="w-8" />
      </div>

      <div className="relative flex-1 mx-4 mt-1 mb-3">
        {isEmpty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-[#8E8E93] text-sm">You've seen everything in this filter mix!</p>
            <button
              onClick={() => setPhase('setup')}
              className="px-6 py-3 bg-[#BF5AF2] rounded-2xl text-white text-sm font-semibold"
            >
              Adjust filters
            </button>
          </div>
        ) : fetching && queue.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-[#48484A] animate-spin" />
          </div>
        ) : (
          [queue[2], queue[1], queue[0]].map((card, i) => {
            if (!card) return null
            const stackIndex = 2 - i
            const isTop = stackIndex === 0
            return (
              <SwipeCard
                key={card.id}
                card={card}
                isTop={isTop}
                stackIndex={stackIndex}
                inCinema={nowPlayingIds.has(card.id)}
                onDecide={handleDecide}
                onReady={isTop ? fn => { topCardFlyOut.current = fn } : undefined}
              />
            )
          })
        )}
      </div>

      {!isEmpty && (
        <div className="shrink-0 flex items-center justify-center gap-10 px-4 pb-5">
          <button
            onClick={() => topCardFlyOut.current?.('left')}
            className="w-[62px] h-[62px] rounded-full bg-[#1C1C1E] border border-white/10 flex items-center justify-center active:scale-95 transition-transform shadow-xl"
          >
            <X className="w-7 h-7 text-rose-400" strokeWidth={2} />
          </button>
          <button
            onClick={() => topCardFlyOut.current?.('right')}
            className="w-[62px] h-[62px] rounded-full bg-[#1C1C1E] border border-white/10 flex items-center justify-center active:scale-95 transition-transform shadow-xl"
          >
            <Check className="w-7 h-7 text-emerald-400" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}
