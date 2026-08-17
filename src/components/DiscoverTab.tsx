import { useState, useRef, useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { X, Check, Loader2, ChevronLeft, Sparkles } from 'lucide-react'
import { getDiscoverByGenres, discoverMovies, posterUrl } from '../lib/tmdb'
import { addSeries, addMovie } from '../lib/api'
import type { TmdbSearchResult, Series, Movie } from '../types'
import { toast } from 'sonner'
import { TVFreakIcon } from './TVFreakIcon'

const TV_GENRES = [
  { id: 18,    label: 'Drama' },
  { id: 80,    label: 'Crime' },
  { id: 10759, label: 'Action' },
  { id: 10765, label: 'Sci-Fi' },
  { id: 9648,  label: 'Mystery' },
  { id: 35,    label: 'Comedy' },
  { id: 99,    label: 'Documentary' },
  { id: 16,    label: 'Animation' },
  { id: 10768, label: 'War' },
  { id: 37,    label: 'Western' },
]

const MOVIE_GENRES = [
  { id: 28,    label: 'Action' },
  { id: 12,    label: 'Adventure' },
  { id: 16,    label: 'Animation' },
  { id: 35,    label: 'Comedy' },
  { id: 80,    label: 'Crime' },
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
  onDecide: (dir: 'left' | 'right') => void
  onReady?: (flyOut: (dir: 'left' | 'right') => void) => void
}

function SwipeCard({ card, isTop, stackIndex, onDecide, onReady }: SwipeCardProps) {
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
      animate={{
        y: stackIndex * 10,
        scale: 1 - stackIndex * 0.045,
      }}
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

      {/* Info overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-5 pb-7">
        <h2 className="text-[22px] font-bold text-white leading-tight mb-2">{card.name}</h2>
        <div className="flex items-center gap-3 mb-2.5">
          {card.first_air_date && (
            <span className="text-sm text-[#8E8E93]">{card.first_air_date.slice(0, 4)}</span>
          )}
          {(card.vote_average ?? 0) > 0 && (
            <span className="text-sm font-medium">
              <span className="text-[#BF5AF2]">★</span>
              <span className="text-white"> {card.vote_average!.toFixed(1)}</span>
            </span>
          )}
        </div>
        {card.overview && (
          <p className="text-[13px] text-[#8E8E93]/75 line-clamp-2 leading-relaxed">{card.overview}</p>
        )}
      </div>

      {/* Like indicator */}
      {isTop && (
        <motion.div className="absolute inset-0 rounded-3xl" style={{ opacity: likeOpacity }}>
          <div className="absolute inset-0 rounded-3xl border-[3px] border-emerald-400 bg-emerald-500/10" />
          <div className="absolute top-5 right-5 bg-emerald-400 rounded-2xl px-3 py-2 flex items-center gap-1.5">
            <Check className="w-5 h-5 text-white" strokeWidth={2.5} />
            <span className="text-white text-sm font-bold tracking-wide">Add</span>
          </div>
        </motion.div>
      )}

      {/* Skip indicator */}
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

// ── Main component ──────────────────────────────────────────────────────────

export function DiscoverTab({ allSeries, allMovies, onSeriesAdded, onMovieAdded }: Props) {
  const [phase, setPhase] = useState<'setup' | 'swiping'>('setup')
  const [mediaMode, setMediaMode] = useState<'tv' | 'movie'>('tv')
  const [selectedGenres, setSelectedGenres] = useState<number[]>([])

  // Swiping state
  const [cards, setCards] = useState<TmdbSearchResult[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [fetching, setFetching] = useState(false)

  // Use refs to avoid stale closures in async fetch
  const fetchPageRef = useRef(3)
  const maxPageRef = useRef(99)
  const fetchingRef = useRef(false)
  const activeGenresRef = useRef<number[]>([])
  const activeModeRef = useRef<'tv' | 'movie'>('tv')
  const seenIds = useRef(new Set<number>())
  const topCardFlyOut = useRef<((dir: 'left' | 'right') => void) | null>(null)

  const queue = cards.slice(currentIdx)
  const topCard = queue[0]
  const isEmpty = !topCard && !fetching

  const libraryIds = new Set(
    (activeModeRef.current === 'tv' ? allSeries : allMovies)
      .map(x => x.tmdbId)
      .filter(Boolean) as number[]
  )

  const genres = mediaMode === 'tv' ? TV_GENRES : MOVIE_GENRES

  async function fetchBatch(page: number): Promise<void> {
    if (fetchingRef.current || page > maxPageRef.current) return
    fetchingRef.current = true
    setFetching(true)
    try {
      const mode = activeModeRef.current
      const genreIds = activeGenresRef.current
      const fetchFn = mode === 'tv' ? getDiscoverByGenres : discoverMovies
      const p2 = Math.min(page + 1, maxPageRef.current)
      const fetches = page < p2
        ? [fetchFn(genreIds, [], page, 'vote_average.desc'), fetchFn(genreIds, [], p2, 'vote_average.desc')]
        : [fetchFn(genreIds, [], page, 'vote_average.desc')]
      const results = await Promise.all(fetches)
      maxPageRef.current = results[0].totalPages
      fetchPageRef.current = (page < p2 ? p2 : page) + 1
      const fresh = results.flatMap(r => r.results).filter(r => {
        if (!r.poster_path || seenIds.current.has(r.id)) return false
        seenIds.current.add(r.id)
        return true
      })
      setCards(prev => [...prev, ...fresh])
    } finally {
      fetchingRef.current = false
      setFetching(false)
    }
  }

  // Auto-fetch when queue runs low
  useEffect(() => {
    if (phase !== 'swiping' || fetchingRef.current) return
    if (queue.length < 6 && fetchPageRef.current <= maxPageRef.current) {
      fetchBatch(fetchPageRef.current)
    }
  }, [queue.length, phase])

  async function handleStart() {
    if (selectedGenres.length === 0) return
    activeGenresRef.current = selectedGenres
    activeModeRef.current = mediaMode
    seenIds.current = new Set()
    fetchPageRef.current = 3
    maxPageRef.current = 99
    setCards([])
    setCurrentIdx(0)
    setPhase('swiping')

    // Initial load: 2 pages
    setFetching(true)
    fetchingRef.current = true
    try {
      const fetchFn = mediaMode === 'tv' ? getDiscoverByGenres : discoverMovies
      const [p1, p2] = await Promise.all([
        fetchFn(selectedGenres, [], 1, 'vote_average.desc'),
        fetchFn(selectedGenres, [], 2, 'vote_average.desc'),
      ])
      maxPageRef.current = p1.totalPages
      const fresh = [...p1.results, ...p2.results].filter(r => {
        if (!r.poster_path || seenIds.current.has(r.id)) return false
        seenIds.current.add(r.id)
        return true
      })
      setCards(fresh)
    } finally {
      fetchingRef.current = false
      setFetching(false)
    }
  }

  async function handleDecide(dir: 'left' | 'right') {
    const card = cards[currentIdx]
    if (!card) return

    if (dir === 'right') {
      if (libraryIds.has(card.id)) {
        toast(`Already in your library`)
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

    setCurrentIdx(i => i + 1)
    topCardFlyOut.current = null
  }

  function toggleGenre(id: number) {
    setSelectedGenres(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  }

  // ── Setup screen ─────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="flex flex-col h-full bg-black">
        <div
          className="shrink-0 px-4 pb-4 bg-black"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
        >
          <div className="flex items-center gap-2 mb-6">
            <TVFreakIcon size={24} />
            <h1 className="text-xl font-bold text-[#F5F5F7]">Discover</h1>
          </div>

          <div className="flex bg-white/5 rounded-2xl p-1 gap-1">
            {(['tv', 'movie'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => { setMediaMode(mode); setSelectedGenres([]) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  mediaMode === mode ? 'bg-[#1C1C1E] text-[#F5F5F7] shadow' : 'text-[#48484A]'
                }`}
              >
                {mode === 'tv' ? 'TV Series' : 'Films'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <p className="text-[10px] text-[#48484A] uppercase tracking-widest font-semibold mb-3">
            What are you in the mood for?
          </p>

          <div className="flex flex-wrap gap-2 mb-8">
            {genres.map(g => (
              <button
                key={g.id}
                onClick={() => toggleGenre(g.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  selectedGenres.includes(g.id)
                    ? 'bg-[#BF5AF2] text-white'
                    : 'bg-[#1C1C1E] text-[#8E8E93] border border-white/8 active:bg-[#2C2C2E]'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleStart}
            disabled={selectedGenres.length === 0}
            className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-25"
            style={{
              background: 'linear-gradient(180deg, #BF5AF2 0%, #A63FD9 100%)',
              boxShadow: selectedGenres.length > 0 ? '0 4px 24px rgba(191,90,242,0.4)' : 'none',
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
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-4 pb-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <button
          onClick={() => setPhase('setup')}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#1C1C1E] border border-white/8 text-[#8E8E93]"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          {currentIdx > 0 && (
            <span className="text-[11px] text-[#48484A] font-medium">{currentIdx} seen</span>
          )}
          {fetching && <Loader2 className="w-3.5 h-3.5 text-[#48484A] animate-spin" />}
        </div>
        <div className="w-8" />
      </div>

      {/* Card stack */}
      <div className="relative flex-1 mx-4 mt-1 mb-3">
        {isEmpty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-[#8E8E93] text-sm">You've seen everything in this genre mix!</p>
            <button
              onClick={() => setPhase('setup')}
              className="px-6 py-3 bg-[#BF5AF2] rounded-2xl text-white text-sm font-semibold"
            >
              Change genres
            </button>
          </div>
        ) : fetching && queue.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-[#48484A] animate-spin" />
          </div>
        ) : (
          // Render back-to-front so the top card is visually on top
          [queue[2], queue[1], queue[0]].map((card, i) => {
            if (!card) return null
            const stackIndex = 2 - i  // 2, 1, 0
            const isTop = stackIndex === 0
            return (
              <SwipeCard
                key={card.id}
                card={card}
                isTop={isTop}
                stackIndex={stackIndex}
                onDecide={handleDecide}
                onReady={isTop ? fn => { topCardFlyOut.current = fn } : undefined}
              />
            )
          })
        )}
      </div>

      {/* Action buttons */}
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
