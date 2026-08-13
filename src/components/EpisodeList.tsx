import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getSeasonEpisodes } from '../lib/tmdb'
import { getWatchedEpisodes, toggleEpisodeWatched, bulkMarkEpisodes, unmarkSeasonEpisodes } from '../lib/api'
import type { TmdbSeason, TmdbEpisode } from '../types'

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

interface ConfirmModal {
  seasonNumber: number
  episodeNumber: number
  previousEpisodes: { seasonNumber: number; episodeNumber: number }[]
}

export function EpisodeList({ seriesId, tmdbId, seasons }: Props) {
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [seasonStates, setSeasonStates] = useState<Record<number, SeasonState>>({})
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null)

  useEffect(() => {
    loadWatched()
  }, [seriesId])

  async function loadWatched() {
    const eps = await getWatchedEpisodes(seriesId)
    setWatched(new Set(eps.map(e => `${e.seasonNumber}-${e.episodeNumber}`)))
  }

  async function toggleSeason(season: TmdbSeason) {
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

    setSeasonStates(prev => ({
      ...prev,
      [sn]: { open: true, episodes: [], loading: true },
    }))

    const episodes = await getSeasonEpisodes(tmdbId, sn)
    setSeasonStates(prev => ({
      ...prev,
      [sn]: { open: true, episodes, loading: false },
    }))
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
        if (!watched.has(`${sn}-${en}`)) {
          result.push({ seasonNumber: sn, episodeNumber: en })
        }
      }
    }
    return result
  }

  async function handleToggleEpisode(seasonNumber: number, episodeNumber: number) {
    const key = `${seasonNumber}-${episodeNumber}`
    const isCurrentlyWatched = watched.has(key)

    if (isCurrentlyWatched) {
      await toggleEpisodeWatched(seriesId, seasonNumber, episodeNumber)
      setWatched(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      return
    }

    const previous = getPreviousUnwatched(seasonNumber, episodeNumber)
    if (previous.length > 0) {
      setConfirmModal({ seasonNumber, episodeNumber, previousEpisodes: previous })
    } else {
      await toggleEpisodeWatched(seriesId, seasonNumber, episodeNumber)
      setWatched(prev => new Set([...prev, key]))
    }
  }

  async function confirmMarkPrevious(markPrevious: boolean) {
    if (!confirmModal) return
    const { seasonNumber, episodeNumber, previousEpisodes } = confirmModal
    setConfirmModal(null)

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

  async function handleMarkAllSeason(season: TmdbSeason) {
    const sn = season.season_number
    const state = seasonStates[sn]
    if (!state?.episodes || state.episodes.length === 0) return

    const allWatched = state.episodes.every(ep => watched.has(`${sn}-${ep.episode_number}`))

    if (allWatched) {
      await unmarkSeasonEpisodes(seriesId, sn)
      setWatched(prev => {
        const next = new Set(prev)
        for (const ep of state.episodes) next.delete(`${sn}-${ep.episode_number}`)
        return next
      })
    } else {
      const unwatched = state.episodes
        .filter(ep => !watched.has(`${sn}-${ep.episode_number}`))
        .map(ep => ({ seasonNumber: sn, episodeNumber: ep.episode_number }))
      await bulkMarkEpisodes(seriesId, unwatched)
      setWatched(prev => {
        const next = new Set(prev)
        for (const ep of state.episodes) next.add(`${sn}-${ep.episode_number}`)
        return next
      })
    }
  }

  function watchedInSeason(seasonNumber: number, total: number) {
    let count = 0
    for (let i = 1; i <= total; i++) {
      if (watched.has(`${seasonNumber}-${i}`)) count++
    }
    return count
  }

  const filteredSeasons = seasons.filter(s => s.season_number > 0)

  return (
    <>
      <div className="space-y-1">
        {filteredSeasons.map(season => {
          const state = seasonStates[season.season_number]
          const watchedCount = watchedInSeason(season.season_number, season.episode_count)
          const pct = season.episode_count > 0 ? (watchedCount / season.episode_count) * 100 : 0
          const showMarkAll = state?.open && !state.loading && state.episodes.length > 0
          const allWatched = showMarkAll && state.episodes.every(ep => watched.has(`${season.season_number}-${ep.episode_number}`))

          return (
            <div key={season.season_number} className="rounded-lg overflow-hidden">
              <div className="flex items-center bg-white/5 hover:bg-white/8 transition-colors">
                <button
                  onClick={() => toggleSeason(season)}
                  className="flex items-center gap-3 px-3 py-2.5 flex-1 text-left min-w-0"
                >
                  {state?.open ? (
                    <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{season.name || `Season ${season.season_number}`}</span>
                      <span className="text-xs text-white/40 ml-2 shrink-0">
                        {watchedCount}/{season.episode_count}
                      </span>
                    </div>
                    <div className="mt-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#6366F1] rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>

                {showMarkAll && (
                  <button
                    onClick={() => handleMarkAllSeason(season)}
                    className="px-3 py-2.5 text-xs text-white/40 hover:text-white/70 transition-colors shrink-0"
                  >
                    {allWatched ? 'Unmark all' : 'Mark all'}
                  </button>
                )}
              </div>

              {state?.open && (
                <div className="bg-[#141414] border-t border-white/5">
                  {state.loading ? (
                    <div className="px-4 py-3 text-xs text-white/30">Loading episodes...</div>
                  ) : (
                    state.episodes.map(ep => {
                      const key = `${season.season_number}-${ep.episode_number}`
                      const isWatched = watched.has(key)
                      return (
                        <label
                          key={ep.episode_number}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-white/3 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isWatched}
                            onChange={() => handleToggleEpisode(season.season_number, ep.episode_number)}
                            className="w-4 h-4 rounded border border-white/20 bg-transparent accent-[#6366F1] cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm ${isWatched ? 'text-white/40 line-through' : 'text-white/80'}`}>
                              <span className="text-white/30 mr-1.5">E{ep.episode_number}</span>
                              {ep.name}
                            </span>
                          </div>
                          {ep.air_date && (
                            <span className="text-xs text-white/25 shrink-0">{ep.air_date.slice(0, 7)}</span>
                          )}
                        </label>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {confirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-[#1E1E1E] rounded-xl p-5 max-w-sm w-full border border-white/10 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-2">Mark previous episodes?</h3>
            <p className="text-sm text-white/60 mb-5">
              There {confirmModal.previousEpisodes.length === 1 ? 'is' : 'are'} {confirmModal.previousEpisodes.length} previous unwatched episode{confirmModal.previousEpisodes.length === 1 ? '' : 's'}. Mark them as watched too?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => confirmMarkPrevious(true)}
                className="flex-1 px-3 py-2 bg-[#6366F1] hover:bg-[#5558E3] text-white text-sm font-medium rounded-lg transition-colors"
              >
                Yes, mark all
              </button>
              <button
                onClick={() => confirmMarkPrevious(false)}
                className="flex-1 px-3 py-2 bg-white/8 hover:bg-white/12 text-white/70 text-sm font-medium rounded-lg transition-colors"
              >
                Just this one
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
