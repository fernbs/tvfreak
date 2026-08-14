import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Loader2, Calendar, CheckCircle2, Plus } from 'lucide-react'
import { getTvDetails, getExternalIds, getImdbRating, getTvRecommendations, getTvSimilar, posterUrl } from '../lib/tmdb'
import { updateSeries, deleteSeries, addSeries } from '../lib/api'
import type { Series, SeriesStatus, TmdbShowDetail, TmdbNextEpisode, TmdbSearchResult } from '../types'
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
  const [localImdbRating, setLocalImdbRating] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [deleteModal, setDeleteModal] = useState(false)
  const [adding, setAdding] = useState(false)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Dep on tmdbId (not id) so previews from search also load
  useEffect(() => {
    if (!series) {
      setDetail(null)
      setDeleteModal(false)
      setRecommendations([])
      setLocalImdbRating(null)
      return
    }
    setNotes(series.notes ?? '')
    setRecommendations([])
    setLocalImdbRating(null)
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
      if (!series.imdbRating) {
        const ext = await getExternalIds(series.tmdbId!)
        if (ext.imdb_id) {
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

    // Merge recommendations + similar, deduplicate, prefer entries with a poster
    Promise.all([
      getTvRecommendations(series.tmdbId),
      getTvSimilar(series.tmdbId),
    ]).then(([recs, similar]) => {
      const seen = new Set<number>()
      const merged: TmdbSearchResult[] = []
      for (const r of [...recs, ...similar]) {
        if (r.poster_path && !seen.has(r.id)) {
          seen.add(r.id)
          merged.push(r)
          if (merged.length >= 12) break
        }
      }
      setRecommendations(merged)
    })
  }, [series?.tmdbId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (deleteModal) setDeleteModal(false)
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, deleteModal])

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

  async function handleMarkDropped() {
    if (!series?.id) return
    await updateSeries(series.id, { status: 'dropped' })
    toast.success(`"${series.title}" marked as dropped`)
    setDeleteModal(false)
    onUpdated()
  }

  async function handleRemove() {
    if (!series?.id) return
    await deleteSeries(series.id)
    toast.success(`"${series.title}" removed from your library`)
    setDeleteModal(false)
    onClose()
    onUpdated()
  }

  async function handleAddToLibrary() {
    if (!series?.tmdbId) return
    setAdding(true)
    try {
      await addSeries({
        tmdbId: series.tmdbId,
        title: series.title,
        status: 'plantowatch',
        posterPath: series.posterPath,
        overview: detail?.overview ?? series.overview,
        firstAirDate: series.firstAirDate,
        lastAirDate: detail?.last_air_date ?? null,
        numberOfSeasons: detail?.number_of_seasons ?? series.numberOfSeasons,
        notes: '',
        nextEpisodeDate: detail?.next_episode_to_air?.air_date ?? null,
        nextEpisodeName: detail?.next_episode_to_air?.name ?? null,
        imdbRating: null,
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

  const poster = posterUrl(series?.posterPath ?? null, 'w500')
  const year = series?.firstAirDate?.slice(0, 4)
  const nextEp = detail?.next_episode_to_air as TmdbNextEpisode | null | undefined
  const isComplete = series?.status === 'completed' && !nextEp
  const hasUpcoming = !!nextEp
  const inLibrary = !!series?.id
  const displayImdbRating = series?.imdbRating ?? localImdbRating

  async function handleAllEpisodesWatched() {
    if (!series?.id) return
    if (series.status === 'completed') return
    if (nextEp) {
      await updateSeries(series.id, { status: 'plantowatch' })
      toast.success(`All caught up on ${series.title}! Next episode: ${formatAirDate(nextEp.air_date)}`)
    } else {
      await updateSeries(series.id, { status: 'completed' })
      toast.success(`${series.title} marked as completed!`)
    }
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
              {inLibrary && (
                <button
                  onClick={() => setDeleteModal(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
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
                    {year ?? 'Unknown year'}
                    {(detail?.number_of_seasons ?? series.numberOfSeasons) ? ` · ${detail?.number_of_seasons ?? series.numberOfSeasons} season${(detail?.number_of_seasons ?? series.numberOfSeasons) === 1 ? '' : 's'}` : ''}
                  </p>
                  {displayImdbRating && (
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                      <span className="text-yellow-400 text-xs">★</span>
                      <span className="text-xs text-yellow-400 font-medium">{displayImdbRating}</span>
                      <span className="text-xs text-yellow-400/50">IMDB</span>
                    </div>
                  )}

                  {/* Complete chip */}
                  {isComplete && inLibrary && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-purple-400" />
                      <span className="text-xs text-purple-400 font-medium">Series complete</span>
                    </div>
                  )}

                  {/* Status buttons (library only) or Add to library */}
                  {inLibrary ? (
                    <div className="mt-3">
                      <p className="text-xs text-white/30 mb-1.5 uppercase tracking-wider font-medium">Status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.entries(STATUS_CONFIG) as [SeriesStatus, (typeof STATUS_CONFIG)[SeriesStatus]][]).map(([status, cfg]) => (
                          <button
                            key={status}
                            onClick={() => changeStatus(status)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                              series.status === status
                                ? `${cfg.bgClass} ${cfg.textClass} border-transparent`
                                : 'border-white/8 text-white/35 hover:border-white/20 hover:text-white/60'
                            }`}
                          >
                            {cfg.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleAddToLibrary}
                      disabled={adding}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-[#6366F1]/15 border border-[#6366F1]/30 rounded-xl text-xs font-medium text-[#6366F1] active:bg-[#6366F1]/25 transition-colors disabled:opacity-50"
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

              {/* Next episode */}
              {hasUpcoming && nextEp && (
                <div className="mb-5 px-3.5 py-3 rounded-xl bg-[#6366F1]/8 border border-[#6366F1]/15">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-[#6366F1]" />
                    <p className="text-xs text-[#6366F1] font-medium uppercase tracking-wider">Next episode</p>
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
                  <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {recommendations.map(r => (
                      <div key={r.id} className="shrink-0 w-[72px]">
                        <div className="w-[72px] h-[108px] rounded-xl overflow-hidden bg-[#1E1E1E] mb-1.5">
                          <img
                            src={posterUrl(r.poster_path, 'w185') ?? ''}
                            alt={r.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <p className="text-[10px] text-white/50 leading-tight line-clamp-2 text-center">{r.name}</p>
                      </div>
                    ))}
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

          {/* Delete modal (library only) */}
          <AnimatePresence>
            {deleteModal && inLibrary && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
              >
                <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setDeleteModal(false)}
                />
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="relative bg-[#1E1E1E] rounded-2xl p-5 max-w-sm w-full border border-white/8 shadow-2xl"
                >
                  <h3 className="text-sm font-semibold text-white truncate mb-0.5">{series.title}</h3>
                  <p className="text-sm text-white/40 mb-5">What do you want to do with this series?</p>

                  <div className="space-y-2">
                    <button
                      onClick={handleMarkDropped}
                      className="w-full px-4 py-3 bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 hover:border-red-500/25 text-left rounded-xl transition-colors"
                    >
                      <span className="text-sm font-medium text-red-400 block">Mark as dropped</span>
                      <span className="text-xs text-red-400/50 mt-0.5 block">Keep in library, change status to Dropped</span>
                    </button>

                    <button
                      onClick={handleRemove}
                      className="w-full px-4 py-3 bg-white/4 hover:bg-red-500/8 border border-white/6 hover:border-red-500/15 text-left rounded-xl transition-colors group"
                    >
                      <span className="text-sm font-medium text-white/60 group-hover:text-red-400 transition-colors block">Remove from library</span>
                      <span className="text-xs text-white/25 group-hover:text-red-400/50 transition-colors mt-0.5 block">Permanently delete this series and all watch history</span>
                    </button>

                    <button
                      onClick={() => setDeleteModal(false)}
                      className="w-full px-4 py-2.5 text-white/40 hover:text-white/60 text-sm font-medium rounded-xl hover:bg-white/4 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  )
}
