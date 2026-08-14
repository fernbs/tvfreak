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

export async function searchTv(query: string): Promise<import('../types').TmdbSearchResult[]> {
  if (!query.trim()) return []
  const url = `${BASE_URL}/search/tv?query=${encodeURIComponent(query)}&language=en-US&page=1`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return []
  const data = await res.json()
  return data.results ?? []
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

export async function getDiscoverByGenres(genreIds: number[]): Promise<import('../types').TmdbSearchResult[]> {
  const genres = genreIds.join(',')
  const url = `${BASE_URL}/discover/tv?with_genres=${genres}&sort_by=vote_average.desc&vote_count.gte=100&language=en-US&page=1`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return []
  const data = await res.json()
  return data.results ?? []
}

export async function getTrending(): Promise<import('../types').TmdbSearchResult[]> {
  const url = `${BASE_URL}/trending/tv/week?language=en-US`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) return []
  const data = await res.json()
  return data.results ?? []
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

export async function getImdbRating(imdbId: string): Promise<string | null> {
  if (!OMDB_KEY || !imdbId) return null
  const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_KEY}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A') {
      return data.imdbRating
    }
    return null
  } catch {
    return null
  }
}
