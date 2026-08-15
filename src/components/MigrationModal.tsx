import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Wand2, Check, AlertCircle } from 'lucide-react'
import { getAllSeries, bulkMarkEpisodes } from '../lib/api'
import { getTvDetails } from '../lib/tmdb'
import { isReleased } from '../lib/utils'
import { STATUS_CONFIG } from '../types'

interface Props {
  onClose: () => void
  onDone: () => void
}

type Step = 'confirm' | 'running' | 'done' | 'error'

const MIGRATION_KEY = 'tvfreak_migration_done'

export function MigrationModal({ onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>('confirm')
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' })
  const [summary, setSummary] = useState({ processed: 0, skipped: 0, markedEpisodes: 0 })
  const [errorMsg, setErrorMsg] = useState('')

  async function runMigration() {
    setStep('running')

    try {
      const all = await getAllSeries()
      const toProcess = all.filter(s => s.tmdbId && s.status !== 'plantowatch')
      setProgress({ done: 0, total: toProcess.length, current: '' })

      let processed = 0
      let skipped = 0
      let markedEpisodes = 0

      for (let i = 0; i < toProcess.length; i++) {
        const series = toProcess[i]
        setProgress({ done: i, total: toProcess.length, current: series.title })

        try {
          const detail = await getTvDetails(series.tmdbId!)
          if (!detail || !series.id) { skipped++; continue }

          const seasons = detail.seasons.filter(s => s.season_number > 0)
          const toMark: { seasonNumber: number; episodeNumber: number }[] = []

          if (series.status === 'completed') {
            for (const season of seasons) {
              for (let ep = 1; ep <= season.episode_count; ep++) {
                toMark.push({ seasonNumber: season.season_number, episodeNumber: ep })
              }
            }
          } else if (series.status === 'watching') {
            const nextEp = detail.next_episode_to_air
            if (nextEp) {
              for (const season of seasons) {
                if (season.season_number < nextEp.season_number) {
                  for (let ep = 1; ep <= season.episode_count; ep++) {
                    toMark.push({ seasonNumber: season.season_number, episodeNumber: ep })
                  }
                } else if (season.season_number === nextEp.season_number) {
                  for (let ep = 1; ep < nextEp.episode_number; ep++) {
                    toMark.push({ seasonNumber: season.season_number, episodeNumber: ep })
                  }
                }
              }
            } else {
              for (const season of seasons) {
                for (let ep = 1; ep <= season.episode_count; ep++) {
                  toMark.push({ seasonNumber: season.season_number, episodeNumber: ep })
                }
              }
            }
          } else if (series.status === 'dropped') {
            const halfCount = Math.ceil(seasons.length / 2)
            for (const season of seasons.slice(0, halfCount)) {
              for (let ep = 1; ep <= season.episode_count; ep++) {
                toMark.push({ seasonNumber: season.season_number, episodeNumber: ep })
              }
            }
          }

          if (toMark.length > 0) {
            await bulkMarkEpisodes(series.id, toMark)
            markedEpisodes += toMark.length
          }

          processed++
        } catch {
          skipped++
        }

        await new Promise(r => setTimeout(r, 200))
      }

      setProgress({ done: toProcess.length, total: toProcess.length, current: '' })
      setSummary({ processed, skipped, markedEpisodes })
      setStep('done')
      localStorage.setItem(MIGRATION_KEY, 'true')
      onDone()
    } catch (err) {
      setErrorMsg(String(err))
      setStep('error')
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step === 'running' ? undefined : onClose} />

      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative bg-[#111111] rounded-3xl border border-white/10 shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/6">
          <Wand2 className="w-4 h-4 text-[#BF5AF2] shrink-0" />
          <h2 className="text-sm font-semibold text-[#F5F5F7] flex-1">Restore watch history from colours</h2>
          {step !== 'running' && (
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1C1C1E] border border-white/8 text-[#8E8E93] transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5">
          {step === 'confirm' && (
            <>
              <p className="text-sm text-[#8E8E93] leading-relaxed mb-4">
                Since your original watch history was lost, this will reconstruct it from the status colour of each series:
              </p>
              <div className="space-y-2.5 mb-5">
                {[
                  { status: 'completed', desc: 'Mark every episode as watched' },
                  { status: 'watching', desc: 'Mark all aired episodes as watched (up to the next unaired one)' },
                  { status: 'dropped', desc: 'Mark the first half of seasons as watched' },
                  { status: 'plantowatch', desc: 'Leave untouched (progress unknown)' },
                ].map(({ status, desc }) => {
                  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
                  return (
                    <div key={status} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: cfg.color }} />
                      <div>
                        <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                        <span className="text-xs text-[#48484A]"> · {desc}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-[#8E8E93] mb-5 px-3 py-2.5 bg-white/3 rounded-xl border border-white/6">
                Episodes already marked won't be changed. This uses your TMDB key and may take a few minutes for large libraries.
              </p>
              <button
                onClick={runMigration}
                className="w-full py-2.5 bg-[#BF5AF2] hover:bg-[#A63FD9] text-white text-sm font-medium rounded-2xl transition-colors"
              >
                Start migration
              </button>
            </>
          )}

          {step === 'running' && (
            <>
              <div className="mb-2 flex justify-between text-xs text-[#48484A]">
                <span className="truncate mr-2">{progress.current || 'Starting...'}</span>
                <span className="shrink-0 tabular-nums">{progress.done}/{progress.total}</span>
              </div>
              <div className="w-full h-[3px] bg-white/7 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-[#BF5AF2] rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-[#48484A] text-center">Don't close this window while it's running</p>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/12 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-[#F5F5F7] mb-1">Done</p>
              <p className="text-xs text-[#48484A] mb-1">{summary.processed} series processed · {summary.markedEpisodes.toLocaleString()} episodes marked</p>
              {summary.skipped > 0 && <p className="text-xs text-[#2C2C2E]">{summary.skipped} skipped (no TMDB data)</p>}
              <button
                onClick={onClose}
                className="mt-5 px-4 py-2 bg-white/8 hover:bg-white/12 text-[#F5F5F7] text-sm font-medium rounded-2xl transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/12 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-rose-400" />
              </div>
              <p className="text-sm font-medium text-[#F5F5F7] mb-1">Something went wrong</p>
              <p className="text-xs text-[#48484A] mb-5">{errorMsg}</p>
              <button
                onClick={() => setStep('confirm')}
                className="px-4 py-2 bg-[#BF5AF2] hover:bg-[#A63FD9] text-white text-sm font-medium rounded-2xl transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export { MIGRATION_KEY }
