import type { Series, WatchedEpisode } from '../types'

const BASE = (import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787').replace(/\/$/, '')

// Single shared promise so all callers get the same fetch result.
let _migrationsPromise: Promise<Set<string>> | null = null

export function preloadMigrations(): Promise<Set<string>> {
  if (!_migrationsPromise) {
    _migrationsPromise = fetch(`${BASE}/api/migrations`)
      .then(r => r.ok ? r.json() as Promise<string[]> : [])
      .then(keys => {
        const set = new Set(keys)
        for (const key of set) localStorage.setItem(key, 'true')
        return set
      })
      .catch(() => new Set<string>())
  }
  return _migrationsPromise
}

export async function markMigration(key: string): Promise<void> {
  const set = await preloadMigrations()
  set.add(key)
  localStorage.setItem(key, 'true')
  await fetch(`${BASE}/api/migrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  }).catch(() => {})
}

export async function isMigrationDone(key: string): Promise<boolean> {
  if (localStorage.getItem(key)) return true
  const set = await preloadMigrations()
  return set.has(key)
}

function parseSeries(row: Record<string, unknown>): Series {
  const rawDates = row.futureDates as string | null
  return {
    ...row,
    nextEpisodeDate: (row.nextEpisodeDate as string | null) ?? null,
    nextEpisodeName: (row.nextEpisodeName as string | null) ?? null,
    imdbRating: (row.imdbRating as string | null) ?? null,
    futureDates: rawDates ? (() => { try { return JSON.parse(rawDates) as string[] } catch { return null } })() : null,
    addedAt: new Date(row.addedAt as string),
    updatedAt: new Date(row.updatedAt as string),
  } as Series
}

function parseWatchedEpisode(row: Record<string, unknown>): WatchedEpisode {
  return {
    ...row,
    watchedAt: new Date(row.watchedAt as string),
  } as WatchedEpisode
}

export async function getAllSeries(): Promise<Series[]> {
  const res = await fetch(`${BASE}/api/series`)
  const data: Record<string, unknown>[] = await res.json()
  return data.map(parseSeries)
}

export async function getSeriesById(id: number): Promise<Series | undefined> {
  const res = await fetch(`${BASE}/api/series/${id}`)
  if (!res.ok) return undefined
  const data: Record<string, unknown> = await res.json()
  return parseSeries(data)
}

export async function addSeries(series: Omit<Series, 'id'>): Promise<number> {
  const res = await fetch(`${BASE}/api/series`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...series,
      addedAt: series.addedAt.toISOString(),
      updatedAt: series.updatedAt.toISOString(),
    }),
  })
  const data: { id: number } = await res.json()
  return data.id
}

export async function getExistingTitles(): Promise<Set<string>> {
  const res = await fetch(`${BASE}/api/series/titles`)
  const titles: string[] = await res.json()
  return new Set(titles)
}

export async function deduplicateSeries(): Promise<number> {
  const res = await fetch(`${BASE}/api/series/deduplicate`, { method: 'POST' })
  const data: { deleted: number } = await res.json()
  return data.deleted
}

export async function updateSeries(id: number, changes: Partial<Series>): Promise<void> {
  const body: Record<string, unknown> = { ...changes, updatedAt: new Date().toISOString() }
  if (body.addedAt instanceof Date) body.addedAt = (body.addedAt as Date).toISOString()
  if (Array.isArray(body.futureDates)) body.futureDates = JSON.stringify(body.futureDates)
  await fetch(`${BASE}/api/series/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function deleteSeries(id: number): Promise<void> {
  await fetch(`${BASE}/api/series/${id}`, { method: 'DELETE' })
}

export async function getWatchedEpisodes(seriesId: number): Promise<WatchedEpisode[]> {
  const res = await fetch(`${BASE}/api/series/${seriesId}/watched`)
  const data: Record<string, unknown>[] = await res.json()
  return data.map(parseWatchedEpisode)
}

export async function toggleEpisodeWatched(
  seriesId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<boolean> {
  const res = await fetch(`${BASE}/api/series/${seriesId}/watched/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seasonNumber, episodeNumber }),
  })
  const data: { watched: boolean } = await res.json()
  return data.watched
}

export async function bulkMarkEpisodes(
  seriesId: number,
  episodes: { seasonNumber: number; episodeNumber: number }[]
): Promise<void> {
  await fetch(`${BASE}/api/series/${seriesId}/watched/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ episodes }),
  })
}

export async function unmarkSeasonEpisodes(seriesId: number, seasonNumber: number): Promise<void> {
  await fetch(`${BASE}/api/series/${seriesId}/watched/season/${seasonNumber}`, {
    method: 'DELETE',
  })
}

export async function isDbEmpty(): Promise<boolean> {
  const series = await getAllSeries()
  return series.length === 0
}

export interface DuplicateGroup {
  series: Series[]
  reason: string
}

export async function getDuplicates(): Promise<DuplicateGroup[]> {
  const res = await fetch(`${BASE}/api/series/duplicates`)
  const data: { series: Record<string, unknown>[]; reason: string }[] = await res.json()
  return data.map(g => ({
    reason: g.reason,
    series: g.series.map(parseSeries),
  }))
}

export interface AppStats {
  totalEpisodes: number
  activityByDate: { date: string; count: number }[]
  topSeries: { seriesId: number; title: string; episodeCount: number }[]
}

export async function getAppStats(): Promise<AppStats> {
  try {
    const res = await fetch(`${BASE}/api/stats`)
    if (!res.ok) return { totalEpisodes: 0, activityByDate: [], topSeries: [] }
    const data = await res.json()
    return {
      totalEpisodes: data.totalEpisodes ?? 0,
      activityByDate: Array.isArray(data.activityByDate) ? data.activityByDate : [],
      topSeries: Array.isArray(data.topSeries) ? data.topSeries : [],
    }
  } catch {
    return { totalEpisodes: 0, activityByDate: [], topSeries: [] }
  }
}

export async function resolveDuplicate(keepId: number, removeId: number): Promise<void> {
  await fetch(`${BASE}/api/series/resolve-duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keepId, removeId }),
  })
}
