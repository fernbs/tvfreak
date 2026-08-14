import Papa from 'papaparse'
import { addSeries, getExistingTitles } from './api'
import { searchTv } from './tmdb'
import type { SeriesStatus } from '../types'

interface CsvRow {
  Title: string
  Type: string
  Status: string
}

function mapStatus(raw: string): SeriesStatus {
  const map: Record<string, SeriesStatus> = {
    completed: 'completed',
    watching: 'watching',
    dropped: 'dropped',
    plantowatch: 'plantowatch',
  }
  return map[raw?.toLowerCase()] ?? 'plantowatch'
}

const CHUNK_SIZE = 8
const CHUNK_DELAY = 200

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export async function importFromCsv(
  onProgress: (done: number, total: number) => void
): Promise<void> {
  const base = import.meta.env.VITE_BASE_URL || '/'
  const csvPath = base.endsWith('/') ? `${base}series_simkl.csv` : `${base}/series_simkl.csv`
  const response = await fetch(csvPath)
  if (!response.ok) return
  const text = await response.text()

  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  })

  const existingTitles = await getExistingTitles()
  const allRows = parsed.data.filter(r => r.Title?.trim())
  const rows = allRows.filter(r => !existingTitles.has(r.Title.toLowerCase().trim()))

  if (rows.length === 0) return

  const total = rows.length
  let done = 0

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)

    await Promise.all(
      chunk.map(async (row) => {
        let tmdbData = null
        try {
          const results = await searchTv(row.Title)
          if (results.length > 0) tmdbData = results[0]
        } catch {
          // TMDB lookup failed, store without poster
        }

        await addSeries({
          tmdbId: tmdbData?.id ?? null,
          title: row.Title,
          status: mapStatus(row.Status),
          posterPath: tmdbData?.poster_path ?? null,
          overview: tmdbData?.overview ?? null,
          firstAirDate: tmdbData?.first_air_date ?? null,
          lastAirDate: null,
          numberOfSeasons: tmdbData?.number_of_seasons ?? null,
          notes: '',
          nextEpisodeDate: null,
          nextEpisodeName: null,
          imdbRating: null,
          futureDates: null,
          addedAt: new Date(),
          updatedAt: new Date(),
        })

        done++
        onProgress(done, total)
      })
    )

    if (i + CHUNK_SIZE < rows.length) {
      await sleep(CHUNK_DELAY)
    }
  }
}
