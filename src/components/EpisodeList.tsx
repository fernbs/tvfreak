import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getSeasonEpisodes } from '../lib/tmdb'
import { getWatchedEpisodes, toggleEpisodeWatched } from '../lib/api'
import type { TmdbSeason, TmdbEpisode, WatchedEpisode } from '../types'

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

export function EpisodeList({ seriesId, tmdbId, seasons }: Props) {
  const [watched, setWatched] = useState<Set<string>>(new Set())
  const [seasonStates, setSeasonStates] = useState<Record<number, SeasonState>>({})

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

  async function handleToggleEpisode(seasonNumber: number, episodeNumber: number) {
    const key = `${seasonNumber}-${episodeNumber}`
    await toggleEpisodeWatched(seriesId, seasonNumber, episodeNumber)
    setWatched(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
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
    <div className="space-y-1">
      {filteredSeasons.map(season => {
        const state = seasonStates[season.season_number]
        const watchedCount = watchedInSeason(season.season_number, season.episode_count)
        const pct = season.episode_count > 0 ? (watchedCount / season.episode_count) * 100 : 0

        return (
          <div key={season.season_number} className="rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSeason(season)}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-white/5 hover:bg-white/8 transition-colors text-left"
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
  )
}
