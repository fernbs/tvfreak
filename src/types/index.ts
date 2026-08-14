export type SeriesStatus = 'completed' | 'watching' | 'dropped' | 'plantowatch'

export interface Series {
  id?: number
  tmdbId: number | null
  title: string
  status: SeriesStatus
  posterPath: string | null
  overview: string | null
  firstAirDate: string | null
  lastAirDate: string | null
  numberOfSeasons: number | null
  notes: string
  nextEpisodeDate: string | null
  nextEpisodeName: string | null
  imdbRating: string | null
  addedAt: Date
  updatedAt: Date
}

export interface WatchedEpisode {
  id?: number
  seriesId: number
  seasonNumber: number
  episodeNumber: number
  watchedAt: Date
}

export interface TmdbSearchResult {
  id: number
  name: string
  poster_path: string | null
  overview: string
  first_air_date: string
  number_of_seasons?: number
}

export interface TmdbSeason {
  season_number: number
  name: string
  episode_count: number
  air_date?: string | null
  episodes?: TmdbEpisode[]
}

export interface TmdbEpisode {
  episode_number: number
  name: string
  air_date: string
  overview: string
}

export interface TmdbNextEpisode {
  air_date: string
  episode_number: number
  season_number: number
  name: string
}

export interface TmdbShowDetail {
  id: number
  name: string
  poster_path: string | null
  overview: string
  first_air_date: string
  last_air_date: string
  number_of_seasons: number
  seasons: TmdbSeason[]
  next_episode_to_air: TmdbNextEpisode | null
}

export const STATUS_CONFIG: Record<SeriesStatus, {
  label: string
  color: string
  bgClass: string
  textClass: string
}> = {
  watching: {
    label: 'Watching',
    color: '#EAB308',
    bgClass: 'bg-yellow-500/15',
    textClass: 'text-yellow-400',
  },
  completed: {
    label: 'Completed',
    color: '#A855F7',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-400',
  },
  dropped: {
    label: 'Dropped',
    color: '#EF4444',
    bgClass: 'bg-red-500/15',
    textClass: 'text-red-400',
  },
  plantowatch: {
    label: 'Pending',
    color: '#22C55E',
    bgClass: 'bg-green-500/15',
    textClass: 'text-green-400',
  },
}
