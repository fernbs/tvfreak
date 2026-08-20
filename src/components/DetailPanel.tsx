import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { X, MoreHorizontal, Loader2, Calendar, CheckCircle2, Plus, Share2, Play } from 'lucide-react'
import confetti from 'canvas-confetti'
import { getTvDetails, getExternalIds, getRatings, getTvRecommendations, getTvSimilar, getWatchProviders, getTrailerKey, posterUrl, IMG_BASE } from '../lib/tmdb'
import { getCountry } from '../lib/settings'
import { updateSeries, deleteSeries, addSeries } from '../lib/api'
import type { Series, SeriesStatus, TmdbShowDetail, TmdbNextEpisode, TmdbSearchResult, WatchProvider } from '../types'
import { STATUS_CONFIG } from '../types'
import { EpisodeList } from './EpisodeList'
import { formatAirDate } from '../lib/utils'
import { toast } from 'sonner'

function fireConfetti() {
  confetti({
    particleCount: 160,
    spread: 100,
    origin: { x: 0.5, y: 0.25 },
    colors: ['#BF5AF2', '#FF0099', '#FF6600', '#FFD60A', '#00C840', '#0A84FF'],
    gravity: 1.1,
    ticks: 220,
  })
}

interface Props {
  series: Series | null
  onClose: () => void
  onUpdated: () => void
  onSelect: (s: Series) => void
}

function recToSeries(r: TmdbSearchResult): Series {
  return {
    id: undefined,
    tmdbId: r.id,
    title: r.name,
    status: 'plantowatch',
    posterPath: r.poster_path ?? null,
    overview: r.overview ?? null,
    firstAirDate: r.first_air_date ?? null,
    lastAirDate: null,
    numberOfSeasons: null,
    notes: '',
    nextEpisodeDate: null,
    nextEpisodeName: null,
    imdbRating: (r.vote_average ?? 0) > 0 ? r.vote_average!.toFixed(1) : null,
    futureDates: null,
    addedAt: new Date(),
    updatedAt: new Date(),
  }
}

export function DetailPanel({ series, onClose, onUpdated, onSelect }: Props) {
  const [minimized, setMinimized] = useState(false)
  const dragControls = useDragControls()
  const [detail, setDetail] = useState<TmdbShowDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [recommendations, setRecommendations] = useState<TmdbSearchResult[]>([])
  const [recsPage, setRecsPage] = useState(1)
  const [loadingMoreRecs, setLoadingMoreRecs] = useState(false)
  const [hasMoreRecs, setHasMoreRecs] = useState(false)
  const [localImdbRating, setLocalImdbRating] = useState<string | null>(null)
  const [imdbId, setImdbId] = useState<string | null>(null)
  const [rtRating, setRtRating] = useState<string | null>(null)
  const [mcRating, setMcRating] = useState<string | null>(null)
  const [ratingsLoaded, setRatingsLoaded] = useState(false)
  const [moreModal, setMoreModal] = useState(false)
  const [adding, setAdding] = useState(false)
  const [providers, setProviders] = useState<WatchProvider[]>([])
  const [watchLink, setWatchLink] = useState<string | null>(null)
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const recsScrollRef = useRef<HTMLDivElement>(null)
  const recsSentinelRef = useRef<HTMLDivElement>(null)
  const handleLoadMoreRecsRef = useRef<() => void>(() => {})

  useEffect(() => {
    setMinimized(false)
    if (!series) {
      setDetail(null)
      setMoreModal(false)
      setRecommendations([])
      setLocalImdbRating(null)
      setImdbId(null)
      return
    }
    setRecommendations([])
    setRecsPage(1)
    setHasMoreRecs(false)
    setLocalImdbRating(null)
    setImdbId(null)
    setRtRating(null)
    setMcRating(null)
    setRatingsLoaded(false)
    if (!series.tmdbId) return

    setLoadingDetail(true)
    getTvDetails(series.tmdbId).then(async d => {
      setDetail(d)
      if (!series.imdbRating && (d?.vote_average ?? 0) > 0) {
        setLocalImdbRating(d!.vote_average!.toFixed(1))
      }
      const updates: Partial<Series> = {}
      if (d?.next_episode_to_air) {
        updates.nextEpisodeDate = d.next_episode_to_air.air_date
        updates.nextEpisodeName = d.next_episode_to_air.name
      } else if (series.nextEpisodeDate) {
        updates.nextEpisodeDate = null
        updates.nextEpisodeName = null
      }
      const ext = await getExternalIds(series.tmdbId!)
      if (ext.imdb_id) {
        setImdbId(ext.imdb_id)
        const { imdb, rt, mc } = await getRatings(ext.imdb_id)
        if (rt) setRtRating(rt)
        if (mc) setMcRating(mc)
        if (imdb) {
          setLocalImdbRating(imdb)
          if (series.id) updates.imdbRating = imdb
        }
        if (rt && series.id) updates.rtRating = rt
      }
      setRatingsLoaded(true)
      if (series.id && Object.keys(updates).length > 0) {
        await updateSeries(series.id, updates)
        onUpdated()
      }
    }).finally(() => setLoadingDetail(false))

    Promise.all([
      getTvRecommendations(series.tmdbId, 1),
      getTvSimilar(series.tmdbId, 1),
    ]).then(([recs, similar]) => {
      const seen = new Set<number>()
      const merged: TmdbSearchResult[] = []
      for (const r of [...recs, ...similar]) {
        if (r.poster_path && !seen.has(r.id)) {
          seen.add(r.id)
          merged.push(r)
        }
      }
      setRecommendations(merged)
      setRecsPage(1)
      setHasMoreRecs(recs.length >= 20 || similar.length >= 20)
    })
  }, [series?.tmdbId])

  useEffect(() => {
    if (!series?.tmdbId) { setProviders([]); setWatchLink(null); setTrailerKey(null); return }
    getWatchProviders(series.tmdbId, getCountry()).then(({ flatrate, free, link }) => {
      const combined: WatchProvider[] = []
      const seen = new Set<number>()
      for (const p of [...flatrate, ...free]) {
        if (!seen.has(p.provider_id)) { seen.add(p.provider_id); combined.push(p) }
      }
      setProviders(combined)
      setWatchLink(link)
    })
    getTrailerKey(series.tmdbId, 'tv').then(setTrailerKey)
  }, [series?.tmdbId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (moreModal) setMoreModal(false)
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, moreModal])

  useEffect(() => {
    if (!hasMoreRecs || loadingMoreRecs) return
    const sentinel = recsSentinelRef.current
    const container = recsScrollRef.current
    if (!sentinel || !container) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleLoadMoreRecsRef.current() },
      { root: container, rootMargin: '0px 150px 0px 0px', threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMoreRecs, loadingMoreRecs])

  async function changeStatus(status: SeriesStatus) {
    if (!series?.id) return
    await updateSeries(series.id, { status })
    if (status === 'completed') fireConfetti()
    toast.success(`Status updated to ${STATUS_CONFIG[status].label}`)
    onUpdated()
  }

  async function handleRemove() {
    if (!series?.id) return
    await deleteSeries(series.id)
    toast.success(`"${series.title}" removed from your library`)
    setMoreModal(false)
    onClose()
    onUpdated()
  }

  async function handleAddToLibrary() {
    if (!series?.tmdbId) return
    setAdding(true)
    try {
      const todayDate = new Date().toISOString().slice(0, 10)
      const isFutureShow = !series.firstAirDate || series.firstAirDate > todayDate
      await addSeries({
        tmdbId: series.tmdbId,
        title: series.title,
        status: isFutureShow ? 'plantowatch' : 'watching',
        posterPath: series.posterPath,
        overview: detail?.overview ?? series.overview,
        firstAirDate: series.firstAirDate,
        lastAirDate: detail?.last_air_date ?? null,
        numberOfSeasons: detail?.number_of_seasons ?? series.numberOfSeasons,
        notes: '',
        nextEpisodeDate: detail?.next_episode_to_air?.air_date ?? null,
        nextEpisodeName: detail?.next_episode_to_air?.name ?? null,
        imdbRating: series.imdbRating,
        futureDates: null,
        addedAt: new Date(),
        updatedAt: new Date(),
      })
      toast.success(`"${series.title}" added to library`)
      onClose()
      onUpdated()
    } finally {
      setAdding(false)
    }
  }

  async function handleLoadMoreRecs() {
    if (!series?.tmdbId || loadingMoreRecs || !hasMoreRecs) return
    setLoadingMoreRecs(true)
    const nextPage = recsPage + 1
    try {
      const [recs, similar] = await Promise.all([
        getTvRecommendations(series.tmdbId, nextPage),
        getTvSimilar(series.tmdbId, nextPage),
      ])
      setRecommendations(prev => {
        const seen = new Set(prev.map(r => r.id))
        const added: TmdbSearchResult[] = []
        for (const r of [...recs, ...similar]) {
          if (r.poster_path && !seen.has(r.id)) {
            seen.add(r.id)
            added.push(r)
          }
        }
        return [...prev, ...added]
      })
      setRecsPage(nextPage)
      setHasMoreRecs(recs.length >= 20 || similar.length >= 20)
    } finally {
      setLoadingMoreRecs(false)
    }
  }

  handleLoadMoreRecsRef.current = handleLoadMoreRecs

  const poster = posterUrl(series?.posterPath ?? null, 'w500')
  const nextEp = detail?.next_episode_to_air as TmdbNextEpisode | null | undefined
  const nextEpDate = nextEp?.air_date ?? (
    series?.nextEpisodeDate && new Date(series.nextEpisodeDate) > new Date()
      ? series.nextEpisodeDate
      : null
  )
  const isComplete = series?.status === 'completed' && !nextEp
  const hasUpcoming = !!nextEp
  const inLibrary = !!series?.id
  const displayImdbRating = series?.imdbRating ?? localImdbRating ?? ((detail?.vote_average ?? 0) > 0 ? detail!.vote_average!.toFixed(1) : null)

  const startYear = series?.firstAirDate?.slice(0, 4)
  const endYear = series?.lastAirDate?.slice(0, 4)
  const isOngoing = detail?.status === 'Returning Series' || detail?.status === 'In Production' || !!nextEp
  const dateRange = startYear
    ? isOngoing
      ? `${startYear}–present`
      : (endYear && endYear !== startYear ? `${startYear}–${endYear}` : startYear)
    : null

  async function handleAllEpisodesWatched() {
    if (!series?.id) return
    if (series.status === 'completed' || series.status === 'dropped') return
    if (series.status === 'plantowatch') {
      await updateSeries(series.id, { status: 'watching' })
      onUpdated()
      return
    }
    if (isOngoing) {
      const msg = nextEp
        ? `All caught up on ${series.title}! Next episode: ${formatAirDate(nextEp.air_date)}`
        : `All caught up on ${series.title}! Waiting for next season.`
      toast.success(msg)
    } else {
      await updateSeries(series.id, { status: 'completed' })
      fireConfetti()
      toast.success(`${series.title} marked as completed!`)
    }
    onUpdated()
  }

  async function handleEpisodeMarked() {
    if (!series?.id || series.status !== 'plantowatch') return
    await updateSeries(series.id, { status: 'watching' })
    onUpdated()
  }

  async function handleShare() {
    if (!series?.tmdbId) return
    const url = `https://www.themoviedb.org/tv/${series.tmdbId}`
    if (navigator.share) {
      try { await navigator.share({ title: series.title, url }) } catch { /* dismissed */ }
    } else {
      try { await navigator.clipboard.writeText(url); toast.success('Link copied') } catch { toast.error('Could not copy link') }
    }
  }

  async function handleSomeEpisodesUnwatched() {
    if (!series?.id) return
    if (series.status !== 'completed' && series.status !== 'plantowatch') return
    await updateSeries(series.id, { status: 'watching' })
    toast(`${series.title} moved back to watching.`)
    onUpdated()
  }

  return (
    <AnimatePresence>
      {series && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: minimized ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (minimized) {
                if (info.velocity.y < -300 || info.offset.y < -40) setMinimized(false)
                else if (info.velocity.y > 400 || info.offset.y > 80) onClose()
              } else {
                if (info.velocity.y > 600 || info.offset.y > 200) onClose()
                else if (info.velocity.y > 200 || info.offset.y > 60) setMinimized(true)
              }
            }}
            initial={{ y: '100%' }}
            animate={{ y: minimized ? 'calc(100% - 80px)' : 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.9 }}
            className="fixed bottom-0 left-0 right-0 h-[93dvh] bg-[#111111] rounded-t-3xl z-50 flex flex-col overflow-hidden border-t border-white/8"
          >
            {/* Drag handle + header — full area is draggable */}
            <div
              className="shrink-0 touch-none"
              onPointerDown={(e) => dragControls.start(e)}
              onClick={() => { if (minimized) setMinimized(false) }}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 rounded-full bg-white/20" />
              </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-1 pb-4">
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#1C1C1E] border border-white/8 text-[#8E8E93] hover:text-[#F5F5F7] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {series?.tmdbId && (
                  <button
                    onClick={handleShare}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-[#48484A] hover:text-[#8E8E93] hover:bg-[#1C1C1E] transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
                {inLibrary && (
                  <button
                    onClick={() => setMoreModal(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-[#48484A] hover:text-[#8E8E93] hover:bg-[#1C1C1E] transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-8">

              {/* Poster + metadata */}
              <div className="flex gap-4 mb-6">
                <div className="w-28 shrink-0 aspect-[2/3] rounded-2xl overflow-hidden bg-[#1C1C1E]">
                  {poster ? (
                    <img src={poster} alt={series.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <span className="text-xs text-[#48484A] text-center">{series.title}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-[#F5F5F7] leading-tight">{series.title}</h2>
                  <p className="text-sm text-[#8E8E93] mt-1">
                    {dateRange ?? 'Unknown year'}
                    {(detail?.number_of_seasons ?? series.numberOfSeasons) ? ` · ${detail?.number_of_seasons ?? series.numberOfSeasons} season${(detail?.number_of_seasons ?? series.numberOfSeasons) === 1 ? '' : 's'}` : ''}
                  </p>

                  {!loadingDetail && (
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <a
                        href={imdbId ? `https://www.imdb.com/title/${imdbId}/` : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => { if (!imdbId) e.preventDefault() }}
                        className="inline-flex items-center gap-1 px-2 py-[3px] bg-white/6 border border-white/10 rounded-full active:opacity-70 transition-opacity"
                      >
                        <span className="bg-[#F5C518] text-black font-black px-[3px] py-[2px] rounded-[2px] leading-none" style={{ fontSize: '7px' }}>IMDb</span>
                        <span className="text-xs font-medium leading-none" style={{ color: displayImdbRating ? 'white' : '#8E8E93' }}>{displayImdbRating ?? 'N/A'}</span>
                      </a>
                      {ratingsLoaded && rtRating && (
                        <a
                          href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(series.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-[3px] bg-white/6 border border-white/10 rounded-full active:opacity-70 transition-opacity"
                        >
                          <span className="leading-none" style={{ fontSize: '12px' }}>🍅</span>
                          <span className="text-xs font-medium text-white leading-none">{rtRating}</span>
                        </a>
                      )}
                      {mcRating && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/6 border border-white/10 rounded-full">
                          <span className="bg-[#66CC33] text-black font-black px-[3px] py-px rounded-[2px] leading-none" style={{ fontSize: '7px' }}>MC</span>
                          <span className="text-xs text-white font-medium leading-none">{mcRating}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Genre chips */}
                  {detail?.genres && detail.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {detail.genres.slice(0, 3).map(g => (
                        <span key={g.id} className="px-1.5 py-0.5 rounded-full text-[10px] text-[#8E8E93] bg-[#1C1C1E] border border-white/8">
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Complete chip */}
                  {isComplete && inLibrary && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/6 border border-white/10 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-[#8E8E93]" />
                      <span className="text-xs text-[#8E8E93] font-medium">Series complete</span>
                    </div>
                  )}

                  {/* Status / Add to library */}
                  {inLibrary ? (
                    <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                      <div
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium"
                        style={{ color: STATUS_CONFIG[series.status].color, backgroundColor: STATUS_CONFIG[series.status].color + '22' }}
                      >
                        {STATUS_CONFIG[series.status].label}
                      </div>
                      {nextEpDate && (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[rgba(var(--accent-rgb),0.1)] text-[var(--color-accent)] border border-[rgba(var(--accent-rgb),0.15)]">
                          <Calendar className="w-3 h-3" />
                          {formatAirDate(nextEpDate)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleAddToLibrary}
                      disabled={adding}
                      className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white active:opacity-80 transition-opacity disabled:opacity-50"
                      style={{ background: 'linear-gradient(180deg, var(--color-accent) 0%, var(--color-accent-hover) 100%)', boxShadow: '0 4px 18px rgba(var(--accent-rgb),0.35)' }}
                    >
                      {adding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Add to library
                    </button>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/6 mb-5" />

              {/* "New episodes coming soon!" banners — date known vs TBA */}
              {series.status === 'plantowatch' && inLibrary && !!nextEpDate && (
                <div
                  className="mb-5 relative overflow-hidden rounded-2xl px-5 py-4"
                  style={{
                    background: `linear-gradient(135deg, rgba(var(--accent-rgb),0.18) 0%, rgba(var(--accent-rgb),0.06) 100%)`,
                    border: `1px solid rgba(var(--accent-rgb),0.22)`,
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at 0% 60%, rgba(var(--accent-rgb),0.22) 0%, transparent 65%)` }}
                  />
                  <p className="relative text-xl font-extrabold text-[#F5F5F7] leading-tight">
                    New episodes coming soon!
                  </p>
                  <p className="relative mt-1.5 text-sm font-semibold" style={{ color: `var(--color-accent)` }}>
                    {formatAirDate(nextEpDate)}
                  </p>
                </div>
              )}
              {series.status === 'plantowatch' && inLibrary && !nextEpDate && (
                <div
                  className="mb-5 relative overflow-hidden rounded-2xl px-5 py-4"
                  style={{
                    background: `linear-gradient(135deg, rgba(var(--accent-rgb),0.18) 0%, rgba(var(--accent-rgb),0.06) 100%)`,
                    border: `1px solid rgba(var(--accent-rgb),0.22)`,
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at 0% 60%, rgba(var(--accent-rgb),0.22) 0%, transparent 65%)` }}
                  />
                  <p className="relative text-[10px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: `rgba(var(--accent-rgb),0.65)` }}>
                    On its way
                  </p>
                  <p className="relative text-xl font-extrabold text-[#F5F5F7] leading-tight">
                    New episodes coming soon!
                  </p>
                </div>
              )}

              {/* "That's all, freaks." banner — only when user has marked series as completed */}
              {series.status === 'completed' && inLibrary && (
                <div
                  className="mb-5 relative overflow-hidden rounded-2xl px-5 py-4"
                  style={{
                    background: `linear-gradient(135deg, rgba(var(--accent-rgb),0.14) 0%, rgba(var(--accent-rgb),0.04) 100%)`,
                    border: `1px solid rgba(var(--accent-rgb),0.18)`,
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at 100% 60%, rgba(var(--accent-rgb),0.18) 0%, transparent 65%)` }}
                  />
                  <p className="relative text-[10px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: `rgba(var(--accent-rgb),0.65)` }}>
                    {detail?.status === 'Canceled' ? 'Cancelled' : 'Series complete'}
                  </p>
                  <p className="relative text-[22px] font-extrabold italic text-[#F5F5F7] leading-tight">
                    That's all, freaks!
                  </p>
                </div>
              )}

              {/* Next episode */}
              {hasUpcoming && nextEp && series.status !== 'plantowatch' && (
                <div className="mb-5 px-4 py-3.5 rounded-2xl bg-[rgba(var(--accent-rgb),0.07)] border border-[rgba(var(--accent-rgb),0.18)]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    <p className="text-[10px] text-[var(--color-accent)] font-semibold uppercase tracking-widest">Next episode</p>
                  </div>
                  <p className="text-sm text-[#F5F5F7] font-medium">
                    S{String(nextEp.season_number).padStart(2, '0')} E{String(nextEp.episode_number).padStart(2, '0')} · {nextEp.name}
                  </p>
                  <p className="text-xs text-[#8E8E93] mt-0.5">{formatAirDate(nextEp.air_date)}</p>
                </div>
              )}

              {/* Creator / overview */}
              {(detail?.overview || series.overview || (detail?.created_by && detail.created_by.length > 0)) && (
                <div className="mb-5">
                  <p className="text-[10px] text-[#48484A] mb-2 uppercase tracking-widest font-semibold">About</p>
                  {detail?.created_by && detail.created_by.length > 0 && (
                    <p className="text-[11px] text-[#8E8E93] mb-2">
                      <span className="text-[#48484A]">Created by</span> {detail.created_by.map(c => c.name).join(', ')}
                    </p>
                  )}
                  {(detail?.overview || series.overview) && (
                    <p className="text-sm text-[#8E8E93] leading-relaxed line-clamp-4">
                      {detail?.overview || series.overview}
                    </p>
                  )}
                </div>
              )}

              {/* Cast */}
              {detail?.credits?.cast && detail.credits.cast.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] text-[#48484A] mb-2.5 uppercase tracking-widest font-semibold">Cast</p>
                  <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {detail.credits.cast.slice(0, 12).map(actor => (
                      <a
                        key={actor.id}
                        href={`https://www.themoviedb.org/person/${actor.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 w-14 text-center block active:opacity-70 transition-opacity"
                      >
                        <div className="w-14 h-14 rounded-full overflow-hidden bg-[#1C1C1E] mb-1 mx-auto">
                          {actor.profile_path ? (
                            <img src={`${IMG_BASE}/w185${actor.profile_path}`} alt={actor.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#2C2C2E]">
                              <span className="text-[18px] font-bold text-[#48484A]">{actor.name[0]}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-[#F5F5F7] leading-tight font-medium line-clamp-2">{actor.name}</p>
                        <p className="text-[8px] text-[#48484A] leading-tight line-clamp-2">{actor.character}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Trailer */}
              {trailerKey && (
                <div className="mb-5">
                  <a
                    href={`https://www.youtube.com/watch?v=${trailerKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/6 border border-white/10 text-sm font-semibold text-[#F5F5F7] active:opacity-70 transition-opacity"
                  >
                    <Play className="w-4 h-4 text-[var(--color-accent)]" />
                    Watch Trailer
                  </a>
                </div>
              )}

              {/* Where to watch */}
              {providers.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] text-[#48484A] mb-2 uppercase tracking-widest font-semibold">Where to watch</p>
                  <div className="flex flex-wrap gap-2">
                    {providers.map(p => (
                      <a
                        key={p.provider_id}
                        href={watchLink ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={p.provider_name}
                        className="w-9 h-9 rounded-xl overflow-hidden bg-[#1C1C1E] border border-white/8 active:opacity-70 transition-opacity shrink-0"
                        onClick={e => { if (!watchLink) e.preventDefault() }}
                      >
                        <img
                          src={`${IMG_BASE}/w45${p.logo_path}`}
                          alt={p.provider_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Episodes */}
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-sm text-[#48484A] mb-5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : detail?.seasons && detail.seasons.length > 0 && series.id ? (
                <div className="mb-5">
                  <p className="text-[10px] text-[#48484A] mb-2.5 uppercase tracking-widest font-semibold">Episodes</p>
                  <EpisodeList
                    seriesId={series.id}
                    tmdbId={detail.id}
                    seasons={detail.seasons}
                    onAllEpisodesWatched={handleAllEpisodesWatched}
                    onSomeEpisodesUnwatched={handleSomeEpisodesUnwatched}
                    onEpisodeMarked={handleEpisodeMarked}
                  />
                </div>
              ) : !series.tmdbId ? (
                <p className="text-sm text-[#48484A] mb-5">No TMDB data available for episode tracking.</p>
              ) : null}

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] text-[#48484A] mb-2.5 uppercase tracking-widest font-semibold">
                    More like {series.title.split(' ').slice(0, 2).join(' ')}
                  </p>
                  <div ref={recsScrollRef} className="flex items-start gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                    {recommendations.map(r => (
                      <button
                        key={r.id}
                        onClick={() => onSelect(recToSeries(r))}
                        className="shrink-0 w-[72px] text-left active:opacity-70 transition-opacity"
                      >
                        <div className="w-[72px] h-[108px] rounded-xl overflow-hidden bg-[#1C1C1E] mb-1.5 relative">
                          <img
                            src={posterUrl(r.poster_path, 'w185') ?? ''}
                            alt={r.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {(r.vote_average ?? 0) > 0 && (
                            <div className="absolute top-1 left-1 px-1 py-[2px] rounded bg-black/65 flex items-center gap-px">
                              <span className="text-[var(--color-accent)] leading-none" style={{ fontSize: '9px' }}>★</span>
                              <span className="text-white font-semibold leading-none" style={{ fontSize: '9px' }}>{r.vote_average!.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-[#8E8E93] leading-tight line-clamp-2 text-center">{r.name}</p>
                      </button>
                    ))}
                    {loadingMoreRecs && (
                      <div className="shrink-0 flex items-center justify-center" style={{ width: 72, height: 108 }}>
                        <Loader2 className="w-4 h-4 text-[#48484A] animate-spin" />
                      </div>
                    )}
                    {hasMoreRecs && <div ref={recsSentinelRef} className="shrink-0 w-4" />}
                  </div>
                </div>
              )}

            </div>
          </motion.div>

          {/* More options modal */}
          <AnimatePresence>
            {moreModal && inLibrary && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
              >
                <div
                  className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                  onClick={() => setMoreModal(false)}
                />
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="relative bg-[#1C1C1E] rounded-3xl p-5 max-w-sm w-full border border-white/10 shadow-2xl"
                >
                  <h3 className="text-sm font-semibold text-[#F5F5F7] truncate mb-4">{series.title}</h3>

                  <p className="text-[10px] text-[#48484A] uppercase tracking-widest mb-2 font-semibold">Change status</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(Object.entries(STATUS_CONFIG) as [SeriesStatus, (typeof STATUS_CONFIG)[SeriesStatus]][]).map(([status, cfg]) => (
                      <button
                        key={status}
                        onClick={async () => { await changeStatus(status); setMoreModal(false) }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                          series.status === status
                            ? 'border-transparent'
                            : 'border-white/8 text-[#48484A] hover:border-white/18 hover:text-[#8E8E93]'
                        }`}
                        style={series.status === status ? { color: cfg.color, backgroundColor: cfg.color + '22' } : {}}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-white/8 mb-3" />

                  <button
                    onClick={handleRemove}
                    className="w-full px-4 py-3 bg-rose-500/8 hover:bg-rose-500/14 border border-rose-500/20 hover:border-rose-500/30 text-left rounded-2xl transition-colors"
                  >
                    <span className="text-sm font-medium text-rose-400 block">Remove from library</span>
                    <span className="text-xs text-rose-400/50 mt-0.5 block">Permanently delete this series and all watch history</span>
                  </button>

                  <button
                    onClick={() => setMoreModal(false)}
                    className="w-full px-4 py-2.5 text-[#48484A] hover:text-[#8E8E93] text-sm font-medium rounded-2xl hover:bg-white/4 transition-colors mt-2"
                  >
                    Cancel
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  )
}
