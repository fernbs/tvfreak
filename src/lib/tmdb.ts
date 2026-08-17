const BEARER = import.meta.env.VITE_TMDB_BEARER_TOKEN
const OMDB_KEY = import.meta.env.VITE_OMDB_API_KEY
const BASE_URL = 'https://api.themoviedb.org/3'
export const IMG_BASE = 'https://image.tmdb.org/t/p'

function headers() {
  return {
    Authorization: `Bearer ${BEARER}`,
    'Content-Type': 'application/json',
  }
}

export async function searchTv(query: string, page = 1, year?: string): Promise<{ results: import('../types').TmdbSearchResult[]; totalPages: number }> {
  if (!query.trim()) return { results: [], totalPages: 0 }
  const params = new URLSearchParams({ query, language: 'en-US', page: String(page) })
  if (year) params.set('first_air_date_year', year)
  const url = `${BASE_URL}/search/tv?${params}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return { results: [], totalPages: 0 }
  const data = await res.json()
  return { results: data.results ?? [], totalPages: data.total_pages ?? 1 }
}

export async function getTvDetails(tmdbId: number): Promise<import('../types').TmdbShowDetail | null> {
  const url = `${BASE_URL}/tv/${tmdbId}?language=en-US`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return null
  return res.json()
}

export async function getSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number
): Promise<import('../types').TmdbEpisode[]> {
  const url = `${BASE_URL}/tv/${tmdbId}/season/${seasonNumber}?language=en-US`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return []
  const data = await res.json()
  return data.episodes ?? []
}

export function posterUrl(path: string | null, size: 'w185' | 'w342' | 'w500' = 'w342'): string | null {
  if (!path) return null
  return `${IMG_BASE}/${size}${path}`
}

export async function getDiscoverByGenres(
  includedIds: number[],
  excludedIds: number[] = [],
  page = 1,
  sortBy = 'vote_average.desc',
  year?: string,
  providerIds: number[] = [],
  region?: string,
  minRating?: number
): Promise<{ results: import('../types').TmdbSearchResult[]; totalPages: number }> {
  const params = new URLSearchParams({
    sort_by: sortBy,
    language: 'en-US',
    page: String(page),
  })
  // vote_count floor only for rating-sorted results to avoid noise
  if (sortBy === 'vote_average.desc') params.set('vote_count.gte', '100')
  if (minRating != null) params.set('vote_average.gte', String(minRating))
  if (includedIds.length > 0) params.set('with_genres', includedIds.join(','))
  if (excludedIds.length > 0) params.set('without_genres', excludedIds.join(','))
  if (year) params.set('first_air_date_year', year)
  if (providerIds.length > 0) {
    // watch_region is required by TMDB — without it, with_watch_providers is silently ignored
    params.set('with_watch_providers', providerIds.join('|'))
    params.set('watch_monetization_types', 'flatrate|free')
    if (region) params.set('watch_region', region)
  }
  const url = `${BASE_URL}/discover/tv?${params}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return { results: [], totalPages: 0 }
  const data = await res.json()
  return { results: data.results ?? [], totalPages: data.total_pages ?? 1 }
}

export async function getStreamingProviders(countryCode: string): Promise<import('../types').WatchProvider[]> {
  const url = `${BASE_URL}/watch/providers/tv?language=en-US&watch_region=${countryCode}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return []
  const data = await res.json()
  const results: (import('../types').WatchProvider & { display_priorities?: Record<string, number> })[] = data.results ?? []
  return results
    .sort((a, b) => {
      const pa = a.display_priorities?.[countryCode] ?? 999
      const pb = b.display_priorities?.[countryCode] ?? 999
      return pa - pb
    })
    .slice(0, 25)
}

export async function getTrending(page = 1): Promise<{ results: import('../types').TmdbSearchResult[]; totalPages: number }> {
  const url = `${BASE_URL}/trending/tv/week?language=en-US&page=${page}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return { results: [], totalPages: 1 }
  const data = await res.json()
  return { results: data.results ?? [], totalPages: data.total_pages ?? 1 }
}

export async function getTvRecommendations(tmdbId: number, page = 1): Promise<import('../types').TmdbSearchResult[]> {
  const url = `${BASE_URL}/tv/${tmdbId}/recommendations?language=en-US&page=${page}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return []
  const data = await res.json()
  return data.results ?? []
}

export async function getTvSimilar(tmdbId: number, page = 1): Promise<import('../types').TmdbSearchResult[]> {
  const url = `${BASE_URL}/tv/${tmdbId}/similar?language=en-US&page=${page}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return []
  const data = await res.json()
  return data.results ?? []
}

export async function getExternalIds(tmdbId: number): Promise<{ imdb_id: string | null }> {
  const url = `${BASE_URL}/tv/${tmdbId}/external_ids`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return { imdb_id: null }
  const data = await res.json()
  return { imdb_id: data.imdb_id ?? null }
}

export async function getWatchProviders(
  tmdbId: number,
  countryCode: string,
): Promise<{ flatrate: import('../types').WatchProvider[]; free: import('../types').WatchProvider[]; link: string | null }> {
  const url = `${BASE_URL}/tv/${tmdbId}/watch/providers`
  try {
    const res = await fetch(url, { headers: headers() })
    if (!res.ok) return { flatrate: [], free: [], link: null }
    const data = await res.json()
    const country = data.results?.[countryCode] ?? {}
    return {
      flatrate: country.flatrate ?? [],
      free: country.free ?? [],
      link: country.link ?? null,
    }
  } catch {
    return { flatrate: [], free: [], link: null }
  }
}

export async function getImdbRating(imdbId: string): Promise<string | null> {
  return (await getRatings(imdbId)).imdb
}

export async function getRatings(imdbId: string): Promise<{ imdb: string | null; rt: string | null }> {
  if (!OMDB_KEY || !imdbId) return { imdb: null, rt: null }
  try {
    const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_KEY}`)
    if (!res.ok) return { imdb: null, rt: null }
    const data = await res.json()
    if (data.Response !== 'True') return { imdb: null, rt: null }
    const imdb = data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : null
    const rtEntry = (data.Ratings ?? []).find((r: { Source: string }) => r.Source === 'Rotten Tomatoes')
    const rt = rtEntry?.Value ?? null
    return { imdb, rt }
  } catch {
    return { imdb: null, rt: null }
  }
}

// ── Movie functions ──────────────────────────────────────────────────────────

function mapMovieResult(r: Record<string, unknown>): import('../types').TmdbSearchResult {
  return {
    id: r.id as number,
    name: r.title as string,
    poster_path: (r.poster_path as string | null) ?? null,
    overview: (r.overview as string) ?? '',
    first_air_date: (r.release_date as string) ?? '',
    vote_average: r.vote_average as number | undefined,
    popularity: r.popularity as number | undefined,
  }
}

export async function searchMovie(query: string, page = 1, year?: string): Promise<{ results: import('../types').TmdbSearchResult[]; totalPages: number }> {
  if (!query.trim()) return { results: [], totalPages: 0 }
  const params = new URLSearchParams({ query, language: 'en-US', page: String(page) })
  if (year) params.set('primary_release_year', year)
  const res = await fetch(`${BASE_URL}/search/movie?${params}`, { headers: headers() })
  if (!res.ok) return { results: [], totalPages: 0 }
  const data = await res.json()
  return { results: (data.results ?? []).map(mapMovieResult), totalPages: data.total_pages ?? 1 }
}

export async function getTrendingMovies(page = 1): Promise<{ results: import('../types').TmdbSearchResult[]; totalPages: number }> {
  const res = await fetch(`${BASE_URL}/trending/movie/week?language=en-US&page=${page}`, { headers: headers() })
  if (!res.ok) return { results: [], totalPages: 1 }
  const data = await res.json()
  return { results: (data.results ?? []).map(mapMovieResult), totalPages: data.total_pages ?? 1 }
}

export async function discoverMovies(
  includedIds: number[],
  excludedIds: number[] = [],
  page = 1,
  sortBy = 'vote_average.desc',
  year?: string,
  providerIds: number[] = [],
  region?: string,
  minRating?: number,
): Promise<{ results: import('../types').TmdbSearchResult[]; totalPages: number }> {
  const params = new URLSearchParams({ sort_by: sortBy, language: 'en-US', page: String(page) })
  if (sortBy === 'vote_average.desc') params.set('vote_count.gte', '200')
  if (minRating != null) params.set('vote_average.gte', String(minRating))
  if (includedIds.length > 0) params.set('with_genres', includedIds.join(','))
  if (excludedIds.length > 0) params.set('without_genres', excludedIds.join(','))
  if (year) params.set('primary_release_year', year)
  if (providerIds.length > 0) {
    params.set('with_watch_providers', providerIds.join('|'))
    params.set('watch_monetization_types', 'flatrate|free')
    if (region) params.set('watch_region', region)
  }
  const res = await fetch(`${BASE_URL}/discover/movie?${params}`, { headers: headers() })
  if (!res.ok) return { results: [], totalPages: 0 }
  const data = await res.json()
  return { results: (data.results ?? []).map(mapMovieResult), totalPages: data.total_pages ?? 1 }
}

export async function getNowPlayingMovieIds(region?: string): Promise<Set<number>> {
  const ids = new Set<number>()
  try {
    const base = new URLSearchParams({ language: 'en-US' })
    if (region) base.set('region', region)
    const [r1, r2] = await Promise.all([
      fetch(`${BASE_URL}/movie/now_playing?${base}&page=1`, { headers: headers() }).then(r => r.ok ? r.json() : { results: [] }),
      fetch(`${BASE_URL}/movie/now_playing?${base}&page=2`, { headers: headers() }).then(r => r.ok ? r.json() : { results: [] }),
    ])
    ;[...(r1.results ?? []), ...(r2.results ?? [])].forEach((m: { id: number }) => ids.add(m.id))
  } catch { /* non-fatal */ }
  return ids
}

export async function getMovieDetails(tmdbId: number): Promise<import('../types').TmdbMovieDetail | null> {
  const res = await fetch(`${BASE_URL}/movie/${tmdbId}?language=en-US`, { headers: headers() })
  if (!res.ok) return null
  return res.json()
}

export async function getMovieRecommendations(tmdbId: number, page = 1): Promise<import('../types').TmdbSearchResult[]> {
  const res = await fetch(`${BASE_URL}/movie/${tmdbId}/recommendations?language=en-US&page=${page}`, { headers: headers() })
  if (!res.ok) return []
  const data = await res.json()
  return (data.results ?? []).map(mapMovieResult)
}

export async function getMovieWatchProviders(
  tmdbId: number,
  countryCode: string,
): Promise<{ flatrate: import('../types').WatchProvider[]; free: import('../types').WatchProvider[]; link: string | null }> {
  try {
    const res = await fetch(`${BASE_URL}/movie/${tmdbId}/watch/providers`, { headers: headers() })
    if (!res.ok) return { flatrate: [], free: [], link: null }
    const data = await res.json()
    const country = data.results?.[countryCode] ?? {}
    return { flatrate: country.flatrate ?? [], free: country.free ?? [], link: country.link ?? null }
  } catch {
    return { flatrate: [], free: [], link: null }
  }
}

export async function getMovieStreamingProviders(countryCode: string): Promise<import('../types').WatchProvider[]> {
  const res = await fetch(`${BASE_URL}/watch/providers/movie?language=en-US&watch_region=${countryCode}`, { headers: headers() })
  if (!res.ok) return []
  const data = await res.json()
  const results: (import('../types').WatchProvider & { display_priorities?: Record<string, number> })[] = data.results ?? []
  return results
    .sort((a, b) => {
      const pa = a.display_priorities?.[countryCode] ?? 999
      const pb = b.display_priorities?.[countryCode] ?? 999
      return pa - pb
    })
    .slice(0, 25)
}

export async function getMovieExternalIds(tmdbId: number): Promise<{ imdb_id: string | null }> {
  const res = await fetch(`${BASE_URL}/movie/${tmdbId}/external_ids`, { headers: headers() })
  if (!res.ok) return { imdb_id: null }
  const data = await res.json()
  return { imdb_id: data.imdb_id ?? null }
}

export async function getTrailerKey(tmdbId: number, type: 'tv' | 'movie'): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/${type}/${tmdbId}/videos?language=en-US`, { headers: headers() })
  if (!res.ok) return null
  const data = await res.json()
  const videos: { key: string; site: string; type: string; official?: boolean }[] = data.results ?? []
  const trailer =
    videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ??
    videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') ??
    videos.find(v => v.site === 'YouTube' && v.type === 'Teaser')
  return trailer?.key ?? null
}
