import type { Series, WatchedEpisode } from '../types'

const BASE = import.meta.env.VITE_WORKER_URL ?? 'http://localhost:8787'

function parseSeries(row: Record<string, unknown>): Series {
  return {
    ...row,
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

export async function isDbEmpty(): Promise<boolean> {
  const series = await getAllSeries()
  return series.length === 0
}
