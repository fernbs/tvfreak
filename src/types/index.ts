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
  futureDates?: string[] | null
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

export interface WatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string
}

export interface TmdbSearchResult {
  id: number
  name: string
  poster_path: string | null
  overview: string
  first_air_date: string
  number_of_seasons?: number
  vote_average?: number
  popularity?: number
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
  last_episode_to_air: TmdbNextEpisode | null
  vote_average?: number
  status?: string
  genres?: { id: number; name: string }[]
}

export const STATUS_CONFIG: Record<SeriesStatus, {
  label: string
  color: string
}> = {
  watching:    { label: 'Watching',  color: '#5AC8FA' },
  completed:   { label: 'Completed', color: '#30D158' },
  dropped:     { label: 'Dropped',   color: '#FF375F' },
  plantowatch: { label: 'Pending',   color: '#FFD60A' },
}

export type MovieStatus = 'completed' | 'watching' | 'plantowatch' | 'dropped'

export interface Movie {
  id?: number
  tmdbId: number | null
  title: string
  status: MovieStatus
  posterPath: string | null
  overview: string | null
  releaseDate: string | null
  runtime: number | null
  notes: string
  imdbRating: string | null
  addedAt: Date
  updatedAt: Date
}

export interface TmdbMovieDetail {
  id: number
  title: string
  poster_path: string | null
  backdrop_path: string | null
  overview: string
  release_date: string
  runtime: number | null
  vote_average?: number
  status?: string
  genres?: { id: number; name: string }[]
}

export const MOVIE_STATUS_CONFIG: Record<MovieStatus, { label: string; color: string }> = {
  watching:    { label: 'Watching',  color: '#5AC8FA' },
  completed:   { label: 'Watched',   color: '#30D158' },
  dropped:     { label: 'Dropped',   color: '#FF375F' },
  plantowatch: { label: 'Watchlist', color: '#FFD60A' },
}
