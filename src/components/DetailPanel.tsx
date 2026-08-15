import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MoreHorizontal, Loader2, Calendar, CheckCircle2, Plus, Share2 } from 'lucide-react'
import { getTvDetails, getExternalIds, getImdbRating, getTvRecommendations, getTvSimilar, getWatchProviders, posterUrl, IMG_BASE } from '../lib/tmdb'
import { getCountry } from '../lib/settings'
import { updateSeries, deleteSeries, addSeries } from '../lib/api'
import type { Series, SeriesStatus, TmdbShowDetail, TmdbNextEpisode, TmdbSearchResult, WatchProvider } from '../types'
import { STATUS_CONFIG } from '../types'
import { EpisodeList } from './EpisodeList'
import { formatAirDate } from '../lib/utils'
import { toast } from 'sonner'

interface Props {
  series: Series | null
  onClose: () => void
  onUpdated: () => void
}

export function DetailPanel({ series, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<TmdbShowDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [recommendations, setRecommendations] = useState<TmdbSearchResult[]>([])
  const [recsPage, setRecsPage] = useState(1)
  const [loadingMoreRecs, setLoadingMoreRecs] = useState(false)
  const [hasMoreRecs, setHasMoreRecs] = useState(false)
  const [localImdbRating, setLocalImdbRating] = useState<string | null>(null)
  const [imdbId, setImdbId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [moreModal, setMoreModal] = useState(false)
  const [adding, setAdding] = useState(false)
  const [providers, setProviders] = useState<WatchProvider[]>([])
  const [watchLink, setWatchLink] = useState<string | null>(null)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Dep on tmdbId (not id) so previews from search also load
  useEffect(() => {
    if (!series) {
      setDetail(null)
      setMoreModal(false)
      setRecommendations([])
      setLocalImdbRating(null)
      setImdbId(null)
      return
    }
    setNotes(series.notes ?? '')
    setRecommendations([])
    setRecsPage(1)
    setHasMoreRecs(false)
    setLocalImdbRating(null)
    setImdbId(null)
    if (!series.tmdbId) return

    setLoadingDetail(true)
    getTvDetails(series.tmdbId).then(async d => {
      setDetail(d)
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
        if (!series.imdbRating) {
          const rating = await getImdbRating(ext.imdb_id)
          if (rating) {
            if (series.id) updates.imdbRating = rating
            else setLocalImdbRating(rating)
          }
        }
      }
      if (series.id && Object.keys(updates).length > 0) {
        await updateSeries(series.id, updates)
      }
    }).finally(() => setLoadingDetail(false))

    // Merge recommendations + similar page 1, deduplicate, filter by poster
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
      // Both endpoints return up to 20 each; if either is full, page 2 may exist
      setHasMoreRecs(recs.length >= 20 || similar.length >= 20)
    })
  }, [series?.tmdbId])

  useEffect(() => {
    if (!series?.tmdbId) { setProviders([]); setWatchLink(null); return }
    getWatchProviders(series.tmdbId, getCountry()).then(({ flatrate, free, link }) => {
      const combined: WatchProvider[] = []
      const seen = new Set<number>()
      for (const p of [...flatrate, ...free]) {
        if (!seen.has(p.provider_id)) { seen.add(p.provider_id); combined.push(p) }
      }
      setProviders(combined)
      setWatchLink(link)
    })
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

  async function changeStatus(status: SeriesStatus) {
    if (!series?.id) return
    await updateSeries(series.id, { status })
    toast.success(`Status updated to ${STATUS_CONFIG[status].label}`)
    onUpdated()
  }

  async function saveNotes(value: string) {
    if (!series?.id) return
    await updateSeries(series.id, { notes: value })
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => saveNotes(value), 800)
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
      const hasReleasedEpisodes = !!(series.firstAirDate && series.firstAirDate <= todayDate && detail?.last_episode_to_air)
      await addSeries({
        tmdbId: series.tmdbId,
        title: series.title,
        status: hasReleasedEpisodes ? 'watching' : 'plantowatch',
        posterPath: series.posterPath,
        overview: detail?.overview ?? series.overview,
        firstAirDate: series.firstAirDate,
        lastAirDate: detail?.last_air_date ?? null,
        numberOfSeasons: detail?.number_of_seasons ?? series.numberOfSeasons,
        notes: '',
        nextEpisodeDate: detail?.next_episode_to_air?.air_date ?? null,
        nextEpisodeName: detail?.next_episode_to_air?.name ?? null,
        imdbRating: null,
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
  const displayImdbRating = series?.imdbRating ?? localImdbRating

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
    if (series.status === 'completed' || series.status === 'dropped' || series.status === 'plantowatch') return
    if (isOngoing) {
      await updateSeries(series.id, { status: 'plantowatch' })
      const msg = nextEp
        ? `All caught up on ${series.title}! Next episode: ${formatAirDate(nextEp.air_date)}`
        : `All caught up on ${series.title}! Waiting for next season.`
      toast.success(msg)
    } else {
      await updateSeries(series.id, { status: 'completed' })
      toast.success(`${series.title} marked as completed!`)
    }
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
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.9 }}
            className="fixed bottom-0 left-0 right-0 h-[93dvh] bg-[#141414] rounded-t-2xl z-50 flex flex-col overflow-hidden border-t border-white/8"
          >
            {/* Drag handle */}
            <div className="shrink-0 flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-4 shrink-0">
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
              <div className="flex items-center gap-1">
                {series?.tmdbId && (
                  <button
                    onClick={handleShare}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/8 text-white/30 hover:text-white/60 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
                {inLibrary && (
                  <button
                    onClick={() => setMoreModal(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/8 text-white/30 hover:text-white/60 transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-8">

              {/* Poster + metadata */}
              <div className="flex gap-4 mb-5">
                <div className="w-28 shrink-0 aspect-[2/3] rounded-xl overflow-hidden bg-[#1E1E1E]">
                  {poster ? (
                    <img src={poster} alt={series.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <span className="text-xs text-white/30 text-center">{series.title}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-white leading-snug">{series.title}</h2>
                  <p className="text-sm text-white/35 mt-0.5">
                    {dateRange ?? 'Unknown year'}
                    {(detail?.number_of_seasons ?? series.numberOfSeasons) ? ` · ${detail?.number_of_seasons ?? series.numberOfSeasons} season${(detail?.number_of_seasons ?? series.numberOfSeasons) === 1 ? '' : 's'}` : ''}
                  </p>
                  {displayImdbRating && (
                    <a
                      href={imdbId ? `https://www.imdb.com/title/${imdbId}/` : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => { if (!imdbId) e.preventDefault() }}
                      className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full active:opacity-70 transition-opacity"
                    >
                      <span className="text-yellow-400 text-xs">★</span>
                      <span className="text-xs text-yellow-400 font-medium">{displayImdbRating}</span>
                    </a>
                  )}

                  {/* Genre chips */}
                  {detail?.genres && detail.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {detail.genres.slice(0, 3).map(g => (
                        <span key={g.id} className="px-1.5 py-0.5 rounded-full text-[10px] text-white/35 bg-white/6 border border-white/6">
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Complete chip */}
                  {isComplete && inLibrary && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-400/10 border border-emerald-400/20 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span className="text-xs text-emerald-400 font-medium">Series complete</span>
                    </div>
                  )}

                  {/* Status (library only) or Add to library */}
                  {inLibrary ? (
                    <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                      {/* Status chip — read-only, change via ⋯ menu */}
                      <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border border-transparent ${STATUS_CONFIG[series.status].bgClass} ${STATUS_CONFIG[series.status].textClass}`}>
                        {STATUS_CONFIG[series.status].label}
                      </div>
                      {/* Next episode date chip */}
                      {nextEpDate && (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#06B6D4]/10 text-[#06B6D4]">
                          <Calendar className="w-3 h-3" />
                          {formatAirDate(nextEpDate)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleAddToLibrary}
                      disabled={adding}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-[#06B6D4]/15 border border-[#06B6D4]/30 rounded-xl text-xs font-medium text-[#06B6D4] active:bg-[#06B6D4]/25 transition-colors disabled:opacity-50"
                    >
                      {adding ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      Add to library
                    </button>
                  )}
                </div>
              </div>

              {/* Overview */}
              {(detail?.overview || series.overview) && (
                <div className="mb-5">
                  <p className="text-xs text-white/30 mb-1.5 uppercase tracking-wider font-medium">About</p>
                  <p className="text-sm text-white/55 leading-relaxed line-clamp-4">
                    {detail?.overview || series.overview}
                  </p>
                </div>
              )}

              {/* Where to watch */}
              {providers.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-white/30 mb-2 uppercase tracking-wider font-medium">Where to watch</p>
                  <div className="flex flex-wrap gap-2">
                    {providers.map(p => (
                      <a
                        key={p.provider_id}
                        href={watchLink ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={p.provider_name}
                        className="w-9 h-9 rounded-xl overflow-hidden bg-[#1E1E1E] border border-white/8 active:opacity-70 transition-opacity shrink-0"
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

              {/* Next episode */}
              {hasUpcoming && nextEp && (
                <div className="mb-5 px-3.5 py-3 rounded-xl bg-[#06B6D4]/8 border border-[#06B6D4]/15">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <p className="text-xs text-[#06B6D4] font-medium uppercase tracking-wider">Next episode</p>
                  </div>
                  <p className="text-sm text-white/80 font-medium">
                    S{String(nextEp.season_number).padStart(2, '0')} E{String(nextEp.episode_number).padStart(2, '0')} · {nextEp.name}
                  </p>
                  <p className="text-xs text-white/35 mt-0.5">{formatAirDate(nextEp.air_date)}</p>
                </div>
              )}

              {/* Episodes (library only) */}
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-sm text-white/25 mb-5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : detail?.seasons && detail.seasons.length > 0 && series.id ? (
                <div className="mb-5">
                  <p className="text-xs text-white/30 mb-2.5 uppercase tracking-wider font-medium">Episodes</p>
                  <EpisodeList
                    seriesId={series.id}
                    tmdbId={detail.id}
                    seasons={detail.seasons}
                    onAllEpisodesWatched={handleAllEpisodesWatched}
                    onSomeEpisodesUnwatched={handleSomeEpisodesUnwatched}
                  />
                </div>
              ) : !series.tmdbId ? (
                <p className="text-sm text-white/20 mb-5">No TMDB data available for episode tracking.</p>
              ) : null}

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-white/30 mb-2.5 uppercase tracking-wider font-medium">
                    More like {series.title.split(' ').slice(0, 2).join(' ')}
                  </p>
                  <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                    {recommendations.map(r => (
                      <div key={r.id} className="shrink-0 w-[72px]">
                        <div className="w-[72px] h-[108px] rounded-xl overflow-hidden bg-[#1E1E1E] mb-1.5 relative">
                          <img
                            src={posterUrl(r.poster_path, 'w185') ?? ''}
                            alt={r.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {(r.vote_average ?? 0) > 0 && (
                            <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/60">
                              <span className="text-[9px] text-yellow-400 font-medium">★ {r.vote_average!.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-white/50 leading-tight line-clamp-2 text-center">{r.name}</p>
                      </div>
                    ))}
                    {/* Load more tile */}
                    {hasMoreRecs && (
                      <div className="shrink-0 w-[72px] flex flex-col items-center justify-center">
                        <button
                          onClick={handleLoadMoreRecs}
                          disabled={loadingMoreRecs}
                          className="w-[72px] h-[108px] rounded-xl bg-white/5 border border-white/8 flex flex-col items-center justify-center gap-1.5 active:bg-white/10 transition-colors disabled:opacity-50"
                        >
                          {loadingMoreRecs ? (
                            <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
                          ) : (
                            <>
                              <span className="text-lg text-white/25">+</span>
                              <span className="text-[9px] text-white/25 font-medium">More</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes (library only) */}
              {inLibrary && (
                <div>
                  <p className="text-xs text-white/30 mb-1.5 uppercase tracking-wider font-medium">Notes</p>
                  <textarea
                    value={notes}
                    onChange={e => handleNotesChange(e.target.value)}
                    placeholder="Add notes..."
                    rows={3}
                    className="w-full bg-[#1E1E1E] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white/75 placeholder:text-white/20 outline-none focus:border-white/20 resize-none transition-colors"
                  />
                </div>
              )}
            </div>
          </motion.div>

          {/* More options modal (library only) */}
          <AnimatePresence>
            {moreModal && inLibrary && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
              >
                <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setMoreModal(false)}
                />
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="relative bg-[#1E1E1E] rounded-2xl p-5 max-w-sm w-full border border-white/8 shadow-2xl"
                >
                  <h3 className="text-sm font-semibold text-white truncate mb-4">{series.title}</h3>

                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Change status</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(Object.entries(STATUS_CONFIG) as [SeriesStatus, (typeof STATUS_CONFIG)[SeriesStatus]][]).map(([status, cfg]) => (
                      <button
                        key={status}
                        onClick={async () => { await changeStatus(status); setMoreModal(false) }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                          series.status === status
                            ? `${cfg.bgClass} ${cfg.textClass} border-transparent`
                            : 'border-white/8 text-white/40 hover:border-white/20 hover:text-white/60'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-white/6 mb-3" />

                  <button
                    onClick={handleRemove}
                    className="w-full px-4 py-3 bg-white/4 hover:bg-red-500/8 border border-white/6 hover:border-red-500/15 text-left rounded-xl transition-colors group"
                  >
                    <span className="text-sm font-medium text-white/60 group-hover:text-red-400 transition-colors block">Remove from library</span>
                    <span className="text-xs text-white/25 group-hover:text-red-400/50 transition-colors mt-0.5 block">Permanently delete this series and all watch history</span>
                  </button>

                  <button
                    onClick={() => setMoreModal(false)}
                    className="w-full px-4 py-2.5 text-white/40 hover:text-white/60 text-sm font-medium rounded-xl hover:bg-white/4 transition-colors mt-2"
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
