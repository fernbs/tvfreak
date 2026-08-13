import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2, Loader2 } from 'lucide-react'
import { getTvDetails, posterUrl } from '../lib/tmdb'
import { updateSeries, deleteSeries } from '../lib/db'
import type { Series, SeriesStatus, TmdbShowDetail } from '../types'
import { STATUS_CONFIG } from '../types'
import { EpisodeList } from './EpisodeList'
import { toast } from 'sonner'

interface Props {
  series: Series | null
  onClose: () => void
  onUpdated: () => void
}

export function DetailPanel({ series, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<TmdbShowDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [notes, setNotes] = useState('')
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!series) {
      setDetail(null)
      return
    }
    setNotes(series.notes ?? '')
    if (series.tmdbId) {
      setLoadingDetail(true)
      getTvDetails(series.tmdbId)
        .then(d => setDetail(d))
        .finally(() => setLoadingDetail(false))
    }
  }, [series?.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

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

  async function handleDelete() {
    if (!series?.id) return
    if (!confirm(`Remove "${series.title}" from your library?`)) return
    await deleteSeries(series.id)
    toast.success(`"${series.title}" removed`)
    onClose()
    onUpdated()
  }

  const poster = posterUrl(series?.posterPath ?? null, 'w500')
  const year = series?.firstAirDate?.slice(0, 4)

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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.8 }}
            className="fixed right-0 top-0 h-full w-full max-w-[420px] bg-[#141414] border-l border-white/8 z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
              <button
                onClick={handleDelete}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pb-8">
              {/* Poster + metadata */}
              <div className="flex gap-4 mb-5">
                <div className="w-28 shrink-0 aspect-[2/3] rounded-lg overflow-hidden bg-[#1E1E1E]">
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
                  <p className="text-sm text-white/40 mt-0.5">
                    {year ?? 'Unknown year'}
                    {series.numberOfSeasons ? ` · ${series.numberOfSeasons} season${series.numberOfSeasons === 1 ? '' : 's'}` : ''}
                  </p>

                  <div className="mt-3">
                    <p className="text-xs text-white/40 mb-1.5 uppercase tracking-wider font-medium">Status</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.entries(STATUS_CONFIG) as [SeriesStatus, (typeof STATUS_CONFIG)[SeriesStatus]][]).map(([status, cfg]) => (
                        <button
                          key={status}
                          onClick={() => changeStatus(status)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                            series.status === status
                              ? `${cfg.bgClass} ${cfg.textClass} border-transparent`
                              : 'border-white/8 text-white/40 hover:border-white/20 hover:text-white/70'
                          }`}
                        >
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Overview */}
              {(detail?.overview || series.overview) && (
                <div className="mb-5">
                  <p className="text-xs text-white/40 mb-1.5 uppercase tracking-wider font-medium">About</p>
                  <p className="text-sm text-white/60 leading-relaxed line-clamp-4">
                    {detail?.overview || series.overview}
                  </p>
                </div>
              )}

              {/* Episodes */}
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-sm text-white/30 mb-5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading episodes...
                </div>
              ) : detail?.seasons && detail.seasons.length > 0 && series.id ? (
                <div className="mb-5">
                  <p className="text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">Episodes</p>
                  <EpisodeList
                    seriesId={series.id}
                    tmdbId={detail.id}
                    seasons={detail.seasons}
                  />
                </div>
              ) : !series.tmdbId ? (
                <p className="text-sm text-white/25 mb-5">No TMDB data available for episode tracking.</p>
              ) : null}

              {/* Notes */}
              <div>
                <p className="text-xs text-white/40 mb-1.5 uppercase tracking-wider font-medium">Notes</p>
                <textarea
                  value={notes}
                  onChange={e => handleNotesChange(e.target.value)}
                  placeholder="Add notes..."
                  rows={3}
                  className="w-full bg-[#1E1E1E] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-white/20 resize-none transition-colors"
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
