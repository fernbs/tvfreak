import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, GitMerge, Check } from 'lucide-react'
import { posterUrl } from '../lib/tmdb'
import { resolveDuplicate } from '../lib/api'
import type { DuplicateGroup } from '../lib/api'
import { STATUS_CONFIG } from '../types'

interface Props {
  groups: DuplicateGroup[]
  onClose: () => void
  onResolved: () => void
}

export function DuplicateModal({ groups, onClose, onResolved }: Props) {
  const [current, setCurrent] = useState(0)
  const [resolving, setResolving] = useState<number | null>(null)
  const [resolved, setResolved] = useState<number[]>([])

  const remaining = groups.filter((_, i) => !resolved.includes(i))
  const group = remaining[current - resolved.filter(i => i < current).length] ?? remaining[0]
  const isDone = remaining.length === 0

  async function handleKeep(keepId: number, removeId: number, groupIndex: number) {
    setResolving(keepId)
    try {
      await resolveDuplicate(keepId, removeId)
      setResolved(prev => [...prev, groupIndex])
      onResolved()
    } finally {
      setResolving(null)
    }
  }

  function handleSkip() {
    const nextIndex = (current + 1) % remaining.length
    setCurrent(nextIndex)
  }

  const originalGroupIndex = groups.indexOf(group)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative bg-[#13101E] rounded-3xl border border-[rgba(167,139,250,0.12)] shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(167,139,250,0.07)]">
          <GitMerge className="w-4 h-4 text-[#B39DFF] shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-[#F0ECFF]">Resolve duplicates</h2>
            <p className="text-xs text-[#4A3F6E] mt-0.5">
              {remaining.length} pair{remaining.length !== 1 ? 's' : ''} remaining
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1C1830] border border-[rgba(167,139,250,0.08)] text-[#9B8EC4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {isDone ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-emerald-500/12 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-[#F0ECFF]">All duplicates resolved</p>
              <p className="text-xs text-[#4A3F6E] mt-1">Your library is clean</p>
              <button
                onClick={onClose}
                className="mt-5 px-4 py-2 bg-[rgba(167,139,250,0.08)] hover:bg-[rgba(167,139,250,0.14)] text-[#F0ECFF] text-sm font-medium rounded-2xl transition-colors"
              >
                Close
              </button>
            </div>
          ) : group ? (
            <>
              <p className="text-xs text-[#4A3F6E] mb-4">
                {group.reason} · Pick which one to keep. Watch history from both will be merged.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {group.series.map(s => {
                  const poster = posterUrl(s.posterPath, 'w185')
                  const config = STATUS_CONFIG[s.status]
                  const otherIds = group.series.filter(o => o.id !== s.id).map(o => o.id!)

                  return (
                    <div key={s.id} className="bg-[#1C1830] rounded-2xl overflow-hidden border border-[rgba(167,139,250,0.08)]">
                      <div className="aspect-[2/3] w-full relative">
                        {poster ? (
                          <img src={poster} alt={s.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-3">
                            <span className="text-xs text-[#4A3F6E] text-center">{s.title}</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ backgroundColor: config.color }} />
                      </div>

                      <div className="p-3">
                        <p className="text-xs font-medium text-[#F0ECFF] leading-snug line-clamp-2 mb-1">{s.title}</p>
                        <p className="text-[11px] text-[#4A3F6E] mb-3">
                          {s.firstAirDate?.slice(0, 4) ?? '?'}
                          {s.numberOfSeasons ? ` · ${s.numberOfSeasons}S` : ''}
                          {' · '}
                          <span style={{ color: config.color }}>{config.label}</span>
                        </p>
                        <button
                          onClick={() => handleKeep(s.id!, otherIds[0], originalGroupIndex)}
                          disabled={resolving !== null}
                          className="w-full py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white text-xs font-medium rounded-xl transition-colors"
                        >
                          {resolving === s.id ? 'Keeping...' : 'Keep this'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {remaining.length > 1 && (
                <button
                  onClick={handleSkip}
                  className="w-full mt-3 py-2 text-[#4A3F6E] hover:text-[#9B8EC4] text-sm transition-colors"
                >
                  Skip for now
                </button>
              )}
            </>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  )
}
