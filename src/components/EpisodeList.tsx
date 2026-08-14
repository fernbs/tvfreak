import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Lock, Check, Minus } from 'lucide-react'
import { getSeasonEpisodes } from '../lib/tmdb'
import { getWatchedEpisodes, toggleEpisodeWatched, bulkMarkEpisodes, unmarkSeasonEpisodes } from '../lib/api'
import type { TmdbSeason, TmdbEpisode } from '../types'
import { formatAirDate, isReleased } from '../lib/utils'

interface Props {
  seriesId: number
  tmdbId: number
  seasons: TmdbSeason[]
}

interface SeasonState {
  open: boolean
  episodes: TmdbEpisode[]
  loading: boolean
}

interface EpisodeModal {
  seasonNumber: number
  episodeNumber: number
  previousEpisodes: { seasonNumber: number; episodeNumber: number }[]
}

interface SeasonModal {
  targetSeason: TmdbSeason
  unwatchedPrevious: TmdbSeason[]
}

function Checkbox({
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  onChange?: () => void
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      className={[
        'w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 transition-all duration-150 border',
        disabled
          ? 'bg-transparent border-white/8 cursor-not-allowed opacity-40'
          : checked
            ? 'bg-[#6366F1] border-[#6366F1] hover:bg-[#5558E3]'
            : indeterminate
              ? 'bg-[#6366F1]/20 border-[#6366F1]/50 hover:border-[#6366F1]/70'
              : 'bg-transparent border-white/20 hover:border-[#6366F1]/60 hover:bg-[#6366F1]/8',
      ].join(' ')}
    >
      {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      {!checked && indeterminate && <Minus className="w-2.5 h-2.5 text-[#6366F1]" strokeWidth={3} />}
    </button>
  )
}

export function EpisodeList({ seriesId, tmdbId, seasons }: Props) {
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [seasonStates, setSeasonStates] = useState<Record<number, SeasonState>>({})
  const [episodeModal, setEpisodeModal] = useState<EpisodeModal | null>(null)
  const [seasonModal, setSeasonModal] = useState<SeasonModal | null>(null)

  useEffect(() => {
    loadWatched()
  }, [seriesId])

  async function loadWatched() {
    const eps = await getWatchedEpisodes(seriesId)
    setWatched(new Set(eps.map(e => `${e.seasonNumber}-${e.episodeNumber}`)))
  }

  async function toggleSeasonOpen(season: TmdbSeason) {
    const sn = season.season_number
    const current = seasonStates[sn]

    if (current?.open) {
      setSeasonStates(prev => ({ ...prev, [sn]: { ...prev[sn], open: false } }))
      return
    }

    if (current?.episodes.length > 0) {
      setSeasonStates(prev => ({ ...prev, [sn]: { ...prev[sn], open: true } }))
      return
    }

    setSeasonStates(prev => ({ ...prev, [sn]: { open: true, episodes: [], loading: true } }))
    const episodes = await getSeasonEpisodes(tmdbId, sn)
    setSeasonStates(prev => ({ ...prev, [sn]: { open: true, episodes, loading: false } }))
  }

  function watchedInSeason(sn: number, total: number): number {
    let count = 0
    for (let i = 1; i <= total; i++) {
      if (watched.has(`${sn}-${i}`)) count++
    }
    return count
  }

  async function markSeasonWatched(season: TmdbSeason) {
    const sn = season.season_number
    const state = seasonStates[sn]
    let toMark: { seasonNumber: number; episodeNumber: number }[]

    if (state?.episodes && state.episodes.length > 0) {
      toMark = state.episodes
        .filter(ep => isReleased(ep.air_date))
        .filter(ep => !watched.has(`${sn}-${ep.episode_number}`))
        .map(ep => ({ seasonNumber: sn, episodeNumber: ep.episode_number }))
    } else {
      toMark = []
      for (let i = 1; i <= season.episode_count; i++) {
        if (!watched.has(`${sn}-${i}`)) toMark.push({ seasonNumber: sn, episodeNumber: i })
      }
    }

    if (toMark.length > 0) {
      await bulkMarkEpisodes(seriesId, toMark)
      setWatched(prev => {
        const next = new Set(prev)
        for (const ep of toMark) next.add(`${ep.seasonNumber}-${ep.episodeNumber}`)
        return next
      })
    }
  }

  async function handleSeasonCheckbox(season: TmdbSeason) {
    const sn = season.season_number
    const watchedCount = watchedInSeason(sn, season.episode_count)
    const allWatched = season.episode_count > 0 && watchedCount === season.episode_count

    if (allWatched) {
      await unmarkSeasonEpisodes(seriesId, sn)
      setWatched(prev => {
        const next = new Set(prev)
        for (let i = 1; i <= season.episode_count; i++) next.delete(`${sn}-${i}`)
        return next
      })
      return
    }

    const unwatchedPrevious = seasons
      .filter(s => s.season_number > 0 && s.season_number < sn)
      .filter(s => watchedInSeason(s.season_number, s.episode_count) < s.episode_count)

    if (unwatchedPrevious.length > 0) {
      setSeasonModal({ targetSeason: season, unwatchedPrevious })
    } else {
      await markSeasonWatched(season)
    }
  }

  async function confirmSeasonModal(markPrevious: boolean) {
    if (!seasonModal) return
    const { targetSeason, unwatchedPrevious } = seasonModal
    setSeasonModal(null)
    if (markPrevious) {
      for (const s of unwatchedPrevious) await markSeasonWatched(s)
    }
    await markSeasonWatched(targetSeason)
  }

  function getPreviousUnwatched(targetSeason: number, targetEpisode: number) {
    const result: { seasonNumber: number; episodeNumber: number }[] = []
    for (const season of seasons.filter(s => s.season_number > 0)) {
      const sn = season.season_number
      if (sn > targetSeason) break
      const state = seasonStates[sn]
      if (!state?.episodes) continue
      for (const ep of state.episodes) {
        const en = ep.episode_number
        if (sn === targetSeason && en >= targetEpisode) break
        if (!watched.has(`${sn}-${en}`)) result.push({ seasonNumber: sn, episodeNumber: en })
      }
    }
    return result
  }

  async function handleToggleEpisode(sn: number, en: number) {
    const key = `${sn}-${en}`
    if (watched.has(key)) {
      await toggleEpisodeWatched(seriesId, sn, en)
      setWatched(prev => { const next = new Set(prev); next.delete(key); return next })
      return
    }

    const previous = getPreviousUnwatched(sn, en)
    if (previous.length > 0) {
      setEpisodeModal({ seasonNumber: sn, episodeNumber: en, previousEpisodes: previous })
    } else {
      await toggleEpisodeWatched(seriesId, sn, en)
      setWatched(prev => new Set([...prev, key]))
    }
  }

  async function confirmEpisodeModal(markPrevious: boolean) {
    if (!episodeModal) return
    const { seasonNumber, episodeNumber, previousEpisodes } = episodeModal
    setEpisodeModal(null)
    const toMark = markPrevious
      ? [...previousEpisodes, { seasonNumber, episodeNumber }]
      : [{ seasonNumber, episodeNumber }]
    await bulkMarkEpisodes(seriesId, toMark)
    setWatched(prev => {
      const next = new Set(prev)
      for (const ep of toMark) next.add(`${ep.seasonNumber}-${ep.episodeNumber}`)
      return next
    })
  }

  const filteredSeasons = seasons.filter(s => s.season_number > 0)

  return (
    <>
      <div className="space-y-1.5">
        {filteredSeasons.map(season => {
          const sn = season.season_number
          const state = seasonStates[sn]
          const watchedCount = watchedInSeason(sn, season.episode_count)
          const allWatched = season.episode_count > 0 && watchedCount === season.episode_count
          const someWatched = watchedCount > 0 && !allWatched
          const pct = season.episode_count > 0 ? (watchedCount / season.episode_count) * 100 : 0

          return (
            <div key={sn} className="rounded-xl overflow-hidden border border-white/6">
              {/* Season header */}
              <div className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${allWatched ? 'bg-[#6366F1]/8' : 'bg-white/4 hover:bg-white/6'}`}>
                <div onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={allWatched}
                    indeterminate={someWatched}
                    onChange={() => handleSeasonCheckbox(season)}
                  />
                </div>

                <button
                  onClick={() => toggleSeasonOpen(season)}
                  className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-sm font-medium truncate ${allWatched ? 'text-white/50' : 'text-white/90'}`}>
                        {season.name || `Season ${sn}`}
                      </span>
                      <span className="text-xs text-white/25 ml-2 shrink-0 tabular-nums">
                        {watchedCount}/{season.episode_count}
                      </span>
                    </div>
                    <div className="h-[2px] bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#6366F1] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-white/25">
                    {state?.open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </div>
                </button>
              </div>

              {/* Episodes */}
              {state?.open && (
                <div className="bg-[#0F0F0F] divide-y divide-white/4">
                  {state.loading ? (
                    <div className="px-4 py-3 text-xs text-white/25">Loading episodes...</div>
                  ) : (
                    state.episodes.map(ep => {
                      const key = `${sn}-${ep.episode_number}`
                      const isWatched = watched.has(key)
                      const released = isReleased(ep.air_date)

                      return (
                        <div
                          key={ep.episode_number}
                          className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                            !released ? 'opacity-70' : isWatched ? '' : 'hover:bg-white/3'
                          }`}
                        >
                          {released ? (
                            <Checkbox
                              checked={isWatched}
                              onChange={() => handleToggleEpisode(sn, ep.episode_number)}
                            />
                          ) : (
                            <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                              <Lock className="w-3 h-3 text-amber-500/50" />
                            </div>
                          )}

                          <span className="text-[11px] font-mono text-white/20 shrink-0 tabular-nums w-7">
                            E{String(ep.episode_number).padStart(2, '0')}
                          </span>

                          <span className={`flex-1 text-sm truncate min-w-0 ${
                            isWatched
                              ? 'line-through text-white/25'
                              : released
                                ? 'text-white/70'
                                : 'text-amber-400/60'
                          }`}>
                            {ep.name}
                          </span>

                          {ep.air_date && (
                            <span className={`text-xs shrink-0 ${released ? 'text-white/20' : 'text-amber-500/50'}`}>
                              {released ? formatAirDate(ep.air_date) : `Airs ${formatAirDate(ep.air_date)}`}
                            </span>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Episode cascade modal */}
      {episodeModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEpisodeModal(null)} />
          <div className="relative bg-[#1E1E1E] rounded-2xl p-5 max-w-sm w-full border border-white/8 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-1.5">Mark previous episodes?</h3>
            <p className="text-sm text-white/50 mb-5 leading-relaxed">
              {episodeModal.previousEpisodes.length} episode{episodeModal.previousEpisodes.length !== 1 ? 's' : ''} before this one {episodeModal.previousEpisodes.length !== 1 ? "aren't" : "isn't"} marked as watched. Mark them too?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => confirmEpisodeModal(true)}
                className="flex-1 px-3 py-2.5 bg-[#6366F1] hover:bg-[#5558E3] text-white text-sm font-medium rounded-xl transition-colors"
              >
                Mark all
              </button>
              <button
                onClick={() => confirmEpisodeModal(false)}
                className="flex-1 px-3 py-2.5 bg-white/6 hover:bg-white/10 text-white/60 text-sm font-medium rounded-xl transition-colors"
              >
                Just this one
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Season cascade modal */}
      {seasonModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSeasonModal(null)} />
          <div className="relative bg-[#1E1E1E] rounded-2xl p-5 max-w-sm w-full border border-white/8 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-1.5">Mark previous seasons?</h3>
            <p className="text-sm text-white/50 mb-3 leading-relaxed">
              Before marking {seasonModal.targetSeason.name || `Season ${seasonModal.targetSeason.season_number}`}, do you want to mark these as watched too?
            </p>
            <div className="mb-4 space-y-1 pl-1">
              {seasonModal.unwatchedPrevious.map(s => (
                <p key={s.season_number} className="text-xs text-white/35">
                  · {s.name || `Season ${s.season_number}`}
                </p>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => confirmSeasonModal(true)}
                className="flex-1 px-3 py-2.5 bg-[#6366F1] hover:bg-[#5558E3] text-white text-sm font-medium rounded-xl transition-colors"
              >
                Mark all
              </button>
              <button
                onClick={() => confirmSeasonModal(false)}
                className="flex-1 px-3 py-2.5 bg-white/6 hover:bg-white/10 text-white/60 text-sm font-medium rounded-xl transition-colors"
              >
                Just this season
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
