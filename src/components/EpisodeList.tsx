import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Lock, Check, Minus, Calendar } from 'lucide-react'
import { getSeasonEpisodes } from '../lib/tmdb'
import { getWatchedEpisodes, toggleEpisodeWatched, bulkMarkEpisodes, unmarkSeasonEpisodes } from '../lib/api'
import type { TmdbSeason, TmdbEpisode } from '../types'
import { formatAirDate, isReleased } from '../lib/utils'

interface Props {
  seriesId: number
  tmdbId: number
  seasons: TmdbSeason[]
  onAllEpisodesWatched?: () => void
  onSomeEpisodesUnwatched?: () => void
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
        'w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0 transition-all duration-150 border',
        disabled
          ? 'bg-transparent border-[rgba(167,139,250,0.08)] cursor-not-allowed opacity-40'
          : checked
            ? 'bg-[#7C3AED] border-[#7C3AED] hover:bg-[#6D28D9]'
            : indeterminate
              ? 'bg-[rgba(124,58,237,0.18)] border-[rgba(124,58,237,0.45)] hover:border-[rgba(124,58,237,0.65)]'
              : 'bg-transparent border-[rgba(167,139,250,0.2)] hover:border-[rgba(167,139,250,0.5)] hover:bg-[rgba(124,58,237,0.06)]',
      ].join(' ')}
    >
      {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      {!checked && indeterminate && <Minus className="w-2.5 h-2.5 text-[#B39DFF]" strokeWidth={3} />}
    </button>
  )
}

function SpecialsSection({ tmdbId, season }: { tmdbId: number; season: import('../types').TmdbSeason }) {
  const [open, setOpen] = useState(false)
  const [episodes, setEpisodes] = useState<TmdbEpisode[]>([])
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (episodes.length === 0) {
      setLoading(true)
      const eps = await getSeasonEpisodes(tmdbId, 0)
      setEpisodes(eps)
      setLoading(false)
    }
  }

  return (
    <div className="mt-2 rounded-xl overflow-hidden border border-[rgba(167,139,250,0.06)] opacity-60">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-[rgba(167,139,250,0.02)] hover:bg-[rgba(167,139,250,0.04)] transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-[#4A3F6E]">Specials</span>
          <span className="text-xs text-[#4A3F6E]/60 ml-2">{season.episode_count} episode{season.episode_count !== 1 ? 's' : ''}</span>
        </div>
        <div className="shrink-0 text-[#4A3F6E]">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </button>
      {open && (
        <div className="bg-[#0C0A14] divide-y divide-[rgba(167,139,250,0.04)]">
          {loading ? (
            <div className="px-4 py-3 text-xs text-[#4A3F6E]">Loading specials...</div>
          ) : episodes.map(ep => (
            <div key={ep.episode_number} className="flex items-center gap-3 px-3 py-2">
              <span className="text-[11px] font-mono text-[#251E3A] shrink-0 tabular-nums w-7">
                S{String(ep.episode_number).padStart(2, '0')}
              </span>
              <span className="flex-1 text-sm text-[#4A3F6E] truncate min-w-0">{ep.name}</span>
              {ep.air_date && (
                <span className="text-xs text-[#251E3A] shrink-0">{formatAirDate(ep.air_date)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function EpisodeList({ seriesId, tmdbId, seasons, onAllEpisodesWatched, onSomeEpisodesUnwatched }: Props) {
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

  function releasedEpisodeCount(freshSeasonEps?: Record<number, TmdbEpisode[]>): number {
    return seasons.filter(s => s.season_number > 0).reduce((sum, s) => {
      const fresh = freshSeasonEps?.[s.season_number]
      if (fresh) {
        return sum + fresh.filter(ep => isReleased(ep.air_date)).length
      }
      const state = seasonStates[s.season_number]
      if (state?.episodes && state.episodes.length > 0) {
        return sum + state.episodes.filter(ep => isReleased(ep.air_date)).length
      }
      if (!s.air_date || s.air_date > today) return sum
      return sum + s.episode_count
    }, 0)
  }

  function checkAllWatched(newWatched: Set<string>, freshSeasonEps?: Record<number, TmdbEpisode[]>) {
    const total = releasedEpisodeCount(freshSeasonEps)
    if (total > 0 && newWatched.size >= total) {
      onAllEpisodesWatched?.()
    }
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

    const badEpisodes = episodes.filter(ep => !isReleased(ep.air_date) && watched.has(`${sn}-${ep.episode_number}`))
    if (badEpisodes.length > 0) {
      setWatched(prev => {
        const next = new Set(prev)
        for (const ep of badEpisodes) next.delete(`${sn}-${ep.episode_number}`)
        return next
      })
      for (const ep of badEpisodes) {
        try { await toggleEpisodeWatched(seriesId, sn, ep.episode_number) } catch { /* ignore */ }
      }
    }
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
    let freshSeasonEps: Record<number, TmdbEpisode[]> | undefined

    if (state?.episodes && state.episodes.length > 0) {
      toMark = state.episodes
        .filter(ep => isReleased(ep.air_date))
        .filter(ep => !watched.has(`${sn}-${ep.episode_number}`))
        .map(ep => ({ seasonNumber: sn, episodeNumber: ep.episode_number }))
    } else {
      const episodes = await getSeasonEpisodes(tmdbId, sn)
      freshSeasonEps = { [sn]: episodes }
      setSeasonStates(prev => ({ ...prev, [sn]: { open: prev[sn]?.open ?? false, episodes, loading: false } }))
      toMark = episodes
        .filter(ep => isReleased(ep.air_date))
        .filter(ep => !watched.has(`${sn}-${ep.episode_number}`))
        .map(ep => ({ seasonNumber: sn, episodeNumber: ep.episode_number }))
    }

    if (toMark.length > 0) {
      await bulkMarkEpisodes(seriesId, toMark)
      const next = new Set(watched)
      for (const ep of toMark) next.add(`${ep.seasonNumber}-${ep.episodeNumber}`)
      setWatched(next)
      checkAllWatched(next, freshSeasonEps)
    }
  }

  async function handleSeasonCheckbox(season: TmdbSeason) {
    const sn = season.season_number
    const state = seasonStates[sn]

    let allWatched: boolean
    if (state?.episodes && state.episodes.length > 0) {
      const releasedEps = state.episodes.filter(ep => isReleased(ep.air_date))
      const watchedCount = releasedEps.filter(ep => watched.has(`${sn}-${ep.episode_number}`)).length
      allWatched = releasedEps.length > 0 && watchedCount === releasedEps.length
    } else {
      const watchedCount = watchedInSeason(sn, season.episode_count)
      allWatched = season.episode_count > 0 && watchedCount === season.episode_count
    }

    if (allWatched) {
      await unmarkSeasonEpisodes(seriesId, sn)
      setWatched(prev => {
        const next = new Set(prev)
        for (let i = 1; i <= season.episode_count; i++) next.delete(`${sn}-${i}`)
        return next
      })
      onSomeEpisodesUnwatched?.()
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
        if (!isReleased(ep.air_date)) continue
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
      onSomeEpisodesUnwatched?.()
      return
    }

    const previous = getPreviousUnwatched(sn, en)
    if (previous.length > 0) {
      setEpisodeModal({ seasonNumber: sn, episodeNumber: en, previousEpisodes: previous })
    } else {
      await toggleEpisodeWatched(seriesId, sn, en)
      const next = new Set([...watched, key])
      setWatched(next)
      checkAllWatched(next)
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
    const next = new Set(watched)
    for (const ep of toMark) next.add(`${ep.seasonNumber}-${ep.episodeNumber}`)
    setWatched(next)
    checkAllWatched(next)
  }

  const today = new Date().toISOString().slice(0, 10)
  const regularSeasons = seasons.filter(s => s.season_number > 0)
  const specialsSeason = seasons.find(s => s.season_number === 0)

  return (
    <>
      <div className="space-y-1.5">
        {regularSeasons.map(season => {
          const sn = season.season_number
          const state = seasonStates[sn]
          const isFuture = !season.air_date || season.air_date > today
          const hasNoEpisodes = season.episode_count === 0

          let watchedCount: number
          let displayTotal: number
          if (state?.episodes && state.episodes.length > 0) {
            const releasedEps = state.episodes.filter(ep => isReleased(ep.air_date))
            displayTotal = releasedEps.length
            watchedCount = releasedEps.filter(ep => watched.has(`${sn}-${ep.episode_number}`)).length
          } else {
            displayTotal = isFuture ? 0 : season.episode_count
            watchedCount = isFuture ? 0 : watchedInSeason(sn, season.episode_count)
          }

          const allWatched = !isFuture && displayTotal > 0 && watchedCount === displayTotal
          const someWatched = !isFuture && watchedCount > 0 && !allWatched
          const pct = displayTotal > 0 ? (watchedCount / displayTotal) * 100 : 0

          return (
            <div key={sn} className="rounded-xl overflow-hidden border border-[rgba(167,139,250,0.07)]">
              {/* Season header */}
              <div className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
                isFuture
                  ? 'bg-[rgba(167,139,250,0.02)]'
                  : allWatched
                    ? 'bg-[rgba(124,58,237,0.07)]'
                    : 'bg-[rgba(167,139,250,0.03)] hover:bg-[rgba(167,139,250,0.05)]'
              }`}>
                <div onClick={e => e.stopPropagation()}>
                  {isFuture ? (
                    <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                      <Calendar className="w-3 h-3 text-amber-500/40" />
                    </div>
                  ) : (
                    <Checkbox
                      checked={allWatched}
                      indeterminate={someWatched}
                      onChange={() => handleSeasonCheckbox(season)}
                    />
                  )}
                </div>

                {isFuture && hasNoEpisodes ? (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#4A3F6E] truncate">
                        {season.name || `Season ${sn}`}
                      </span>
                      <span className="text-xs text-amber-500/50 ml-2 shrink-0">
                        {season.air_date ? `Premieres ${formatAirDate(season.air_date)}` : 'Coming soon'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleSeasonOpen(season)}
                    className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-sm font-medium truncate ${
                          isFuture
                            ? 'text-[#4A3F6E]'
                            : allWatched
                              ? 'text-[#9B8EC4]'
                              : 'text-[#F0ECFF]'
                        }`}>
                          {season.name || `Season ${sn}`}
                        </span>
                        {isFuture ? (
                          <span className="text-xs text-amber-500/50 ml-2 shrink-0">
                            {season.air_date ? `Premieres ${formatAirDate(season.air_date)}` : 'Coming soon'}
                          </span>
                        ) : (
                          <span className="text-xs text-[#4A3F6E] ml-2 shrink-0 tabular-nums">
                            {watchedCount}/{displayTotal}
                          </span>
                        )}
                      </div>
                      {!isFuture && (
                        <div className="h-[3px] bg-[rgba(167,139,250,0.08)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#7C3AED] rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-[#4A3F6E]">
                      {state?.open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                )}
              </div>

              {/* Episodes */}
              {state?.open && (
                <div className="bg-[#0C0A14] divide-y divide-[rgba(167,139,250,0.04)]">
                  {state.loading ? (
                    <div className="px-4 py-3 text-xs text-[#4A3F6E]">Loading episodes...</div>
                  ) : (
                    state.episodes.map(ep => {
                      const key = `${sn}-${ep.episode_number}`
                      const isWatched = watched.has(key)
                      const released = isReleased(ep.air_date)

                      return (
                        <div
                          key={ep.episode_number}
                          className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                            !released ? 'opacity-70' : isWatched ? '' : 'hover:bg-[rgba(167,139,250,0.03)]'
                          }`}
                        >
                          {released ? (
                            <Checkbox
                              checked={isWatched}
                              onChange={() => handleToggleEpisode(sn, ep.episode_number)}
                            />
                          ) : (
                            <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                              <Lock className="w-3 h-3 text-amber-500/40" />
                            </div>
                          )}

                          <span className="text-[11px] font-mono text-[#251E3A] shrink-0 tabular-nums w-7">
                            E{String(ep.episode_number).padStart(2, '0')}
                          </span>

                          <span className={`flex-1 text-sm truncate min-w-0 ${
                            isWatched
                              ? 'line-through text-[#4A3F6E]'
                              : released
                                ? 'text-[#9B8EC4]'
                                : 'text-amber-400/60'
                          }`}>
                            {ep.name}
                          </span>

                          {ep.air_date ? (
                            <span className={`text-xs shrink-0 ${released ? 'text-[#251E3A]' : 'text-amber-500/50'}`}>
                              {released ? formatAirDate(ep.air_date) : `Airs ${formatAirDate(ep.air_date)}`}
                            </span>
                          ) : !released ? (
                            <span className="text-xs shrink-0 text-amber-500/40">TBA</span>
                          ) : null}
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

      {specialsSeason && specialsSeason.episode_count > 0 && (
        <SpecialsSection tmdbId={tmdbId} season={specialsSeason} />
      )}

      {/* Episode cascade modal */}
      {episodeModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setEpisodeModal(null)} />
          <div className="relative bg-[#1C1830] rounded-3xl p-5 max-w-sm w-full border border-[rgba(167,139,250,0.12)] shadow-2xl">
            <h3 className="text-sm font-semibold text-[#F0ECFF] mb-1.5">Mark previous episodes?</h3>
            <p className="text-sm text-[#9B8EC4] mb-5 leading-relaxed">
              {episodeModal.previousEpisodes.length} episode{episodeModal.previousEpisodes.length !== 1 ? 's' : ''} before this one {episodeModal.previousEpisodes.length !== 1 ? "aren't" : "isn't"} marked as watched. Mark them too?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => confirmEpisodeModal(true)}
                className="flex-1 px-3 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-2xl transition-colors"
              >
                Mark all
              </button>
              <button
                onClick={() => confirmEpisodeModal(false)}
                className="flex-1 px-3 py-2.5 bg-[rgba(167,139,250,0.06)] hover:bg-[rgba(167,139,250,0.1)] text-[#9B8EC4] text-sm font-medium rounded-2xl transition-colors border border-[rgba(167,139,250,0.08)]"
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
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setSeasonModal(null)} />
          <div className="relative bg-[#1C1830] rounded-3xl p-5 max-w-sm w-full border border-[rgba(167,139,250,0.12)] shadow-2xl">
            <h3 className="text-sm font-semibold text-[#F0ECFF] mb-1.5">Mark previous seasons?</h3>
            <p className="text-sm text-[#9B8EC4] mb-3 leading-relaxed">
              Before marking {seasonModal.targetSeason.name || `Season ${seasonModal.targetSeason.season_number}`}, do you want to mark these as watched too?
            </p>
            <div className="mb-4 space-y-1 pl-1">
              {seasonModal.unwatchedPrevious.map(s => (
                <p key={s.season_number} className="text-xs text-[#4A3F6E]">
                  · {s.name || `Season ${s.season_number}`}
                </p>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => confirmSeasonModal(true)}
                className="flex-1 px-3 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-2xl transition-colors"
              >
                Mark all
              </button>
              <button
                onClick={() => confirmSeasonModal(false)}
                className="flex-1 px-3 py-2.5 bg-[rgba(167,139,250,0.06)] hover:bg-[rgba(167,139,250,0.1)] text-[#9B8EC4] text-sm font-medium rounded-2xl transition-colors border border-[rgba(167,139,250,0.08)]"
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
