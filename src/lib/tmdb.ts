const BEARER = import.meta.env.VITE_TMDB_BEARER_TOKEN
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
