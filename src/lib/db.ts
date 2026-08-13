import Dexie, { type EntityTable } from 'dexie'
import type { Series, WatchedEpisode } from '../types'

class TvfreakDB extends Dexie {
  series!: EntityTable<Series, 'id'>
  watchedEpisodes!: EntityTable<WatchedEpisode, 'id'>

  constructor() {
    super('tvfreak')
    this.version(1).stores({
      series: '++id, tmdbId, title, status, addedAt, updatedAt',
      watchedEpisodes: '++id, seriesId, [seriesId+seasonNumber+episodeNumber]',
    })
  }
}

export const db = new TvfreakDB()

export async function isDbEmpty(): Promise<boolean> {
  const count = await db.series.count()
  return count === 0
}

export async function getAllSeries(): Promise<Series[]> {
  return db.series.orderBy('title').toArray()
}

export async function getSeriesById(id: number): Promise<Series | undefined> {
  return db.series.get(id)
}

export async function addSeries(series: Omit<Series, 'id'>): Promise<number> {
  return db.series.add(series)
}

export async function getExistingTitles(): Promise<Set<string>> {
  const all = await db.series.toArray()
  return new Set(all.map(s => s.title.toLowerCase().trim()))
}

export async function deduplicateSeries(): Promise<number> {
  const all = await db.series.orderBy('id').toArray()
  const seen = new Map<string, Series>()
  const toDelete: number[] = []

  for (const s of all) {
    const key = s.title.toLowerCase().trim()
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, s)
    } else {
      // Keep the one with more data; drop the other
      const keepExisting =
        (existing.posterPath ? 1 : 0) + (existing.tmdbId ? 1 : 0) >=
        (s.posterPath ? 1 : 0) + (s.tmdbId ? 1 : 0)
      if (keepExisting) {
        toDelete.push(s.id!)
      } else {
        toDelete.push(existing.id!)
        seen.set(key, s)
      }
    }
  }

  for (const id of toDelete) {
    await db.series.delete(id)
    await db.watchedEpisodes.where('seriesId').equals(id).delete()
  }

  return toDelete.length
}

export async function updateSeries(id: number, changes: Partial<Series>): Promise<void> {
  await db.series.update(id, { ...changes, updatedAt: new Date() })
}

export async function deleteSeries(id: number): Promise<void> {
  await db.series.delete(id)
  await db.watchedEpisodes.where('seriesId').equals(id).delete()
}

export async function getWatchedEpisodes(seriesId: number): Promise<WatchedEpisode[]> {
  return db.watchedEpisodes.where('seriesId').equals(seriesId).toArray()
}

export async function toggleEpisodeWatched(
  seriesId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<boolean> {
  const existing = await db.watchedEpisodes
    .where('[seriesId+seasonNumber+episodeNumber]')
    .equals([seriesId, seasonNumber, episodeNumber])
    .first()

  if (existing?.id) {
    await db.watchedEpisodes.delete(existing.id)
    return false
  } else {
    await db.watchedEpisodes.add({ seriesId, seasonNumber, episodeNumber, watchedAt: new Date() })
    return true
  }
}
