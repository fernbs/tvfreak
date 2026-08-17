interface Env {
  DB: D1Database
}

const ALLOWED_SERIES_FIELDS = new Set([
  'tmdbId', 'title', 'status', 'posterPath', 'overview',
  'firstAirDate', 'lastAirDate', 'numberOfSeasons', 'notes',
  'addedAt', 'updatedAt', 'nextEpisodeDate', 'nextEpisodeName', 'imdbRating', 'futureDates',
])

const ALLOWED_MOVIE_FIELDS = new Set([
  'tmdbId', 'title', 'status', 'posterPath', 'overview',
  'releaseDate', 'runtime', 'notes', 'addedAt', 'updatedAt', 'imdbRating',
])

const STATUS_PRIORITY: Record<string, number> = {
  watching: 3,
  completed: 2,
  dropped: 1,
  plantowatch: 0,
}

function corsHeaders(origin: string) {
  const allowed =
    origin === 'https://fernbs.github.io' || origin.startsWith('http://localhost')
      ? origin
      : 'https://fernbs.github.io'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(data: unknown, status = 200, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method
    const origin = request.headers.get('Origin') ?? ''
    const cors = corsHeaders(origin)

    if (method === 'OPTIONS') {
      return new Response(null, { headers: cors })
    }

    try {
      // GET /api/series
      if (path === '/api/series' && method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM series ORDER BY title ASC'
        ).all()
        return json(results, 200, cors)
      }

      // GET /api/series/titles
      if (path === '/api/series/titles' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT title FROM series').all()
        const titles = results.map(r => (r.title as string).toLowerCase().trim())
        return json(titles, 200, cors)
      }

      // GET /api/series/duplicates
      if (path === '/api/series/duplicates' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM series ORDER BY id ASC').all()

        const byTmdbId = new Map<number, typeof results>()
        for (const s of results) {
          if (s.tmdbId) {
            const id = s.tmdbId as number
            if (!byTmdbId.has(id)) byTmdbId.set(id, [])
            byTmdbId.get(id)!.push(s)
          }
        }

        const byTitle = new Map<string, typeof results>()
        for (const s of results) {
          const key = (s.title as string).toLowerCase().replace(/[^a-z0-9]/g, '')
          if (!byTitle.has(key)) byTitle.set(key, [])
          byTitle.get(key)!.push(s)
        }

        const seenKeys = new Set<string>()
        const groups: { series: unknown[]; reason: string }[] = []

        for (const [, items] of byTmdbId) {
          if (items.length < 2) continue
          const key = items.map(i => i.id).sort().join(',')
          if (!seenKeys.has(key)) { seenKeys.add(key); groups.push({ series: items, reason: 'Same TMDB ID' }) }
        }
        for (const [, items] of byTitle) {
          if (items.length < 2) continue
          const key = items.map(i => i.id).sort().join(',')
          if (!seenKeys.has(key)) { seenKeys.add(key); groups.push({ series: items, reason: 'Similar title' }) }
        }

        return json(groups, 200, cors)
      }

      // POST /api/series/resolve-duplicate
      if (path === '/api/series/resolve-duplicate' && method === 'POST') {
        const body = await request.json() as { keepId: number; removeId: number }
        // Transfer watched episodes from removed series to kept series before deleting
        await env.DB.prepare(
          `INSERT OR IGNORE INTO watchedEpisodes (seriesId, seasonNumber, episodeNumber, watchedAt)
           SELECT ?, seasonNumber, episodeNumber, watchedAt FROM watchedEpisodes WHERE seriesId = ?`
        ).bind(body.keepId, body.removeId).run()
        await env.DB.prepare('DELETE FROM watchedEpisodes WHERE seriesId = ?').bind(body.removeId).run()
        await env.DB.prepare('DELETE FROM series WHERE id = ?').bind(body.removeId).run()
        return json({ ok: true }, 200, cors)
      }

      // POST /api/series/deduplicate
      if (path === '/api/series/deduplicate' && method === 'POST') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM series ORDER BY id ASC'
        ).all()

        type SeriesRow = { id: number; status: string; posterPath: unknown; tmdbId: unknown }
        const seen = new Map<string, SeriesRow>()
        const toDelete: number[] = []

        for (const s of results) {
          const key = (s.title as string).toLowerCase().trim()
          const id = s.id as number
          const current: SeriesRow = { id, status: s.status as string, posterPath: s.posterPath, tmdbId: s.tmdbId }
          const existing = seen.get(key)

          if (!existing) {
            seen.set(key, current)
          } else {
            const existingPriority = STATUS_PRIORITY[existing.status] ?? 0
            const currentPriority = STATUS_PRIORITY[current.status] ?? 0

            let keepExisting: boolean
            if (existingPriority !== currentPriority) {
              keepExisting = existingPriority > currentPriority
            } else {
              const existingScore = (existing.posterPath ? 1 : 0) + (existing.tmdbId ? 1 : 0)
              const currentScore = (current.posterPath ? 1 : 0) + (current.tmdbId ? 1 : 0)
              keepExisting = existingScore >= currentScore
            }

            if (keepExisting) {
              toDelete.push(id)
            } else {
              toDelete.push(existing.id)
              seen.set(key, current)
            }
          }
        }

        for (const id of toDelete) {
          await env.DB.prepare('DELETE FROM watchedEpisodes WHERE seriesId = ?').bind(id).run()
          await env.DB.prepare('DELETE FROM series WHERE id = ?').bind(id).run()
        }

        return json({ deleted: toDelete.length }, 200, cors)
      }

      // POST /api/series
      if (path === '/api/series' && method === 'POST') {
        const body = await request.json() as Record<string, unknown>
        const result = await env.DB.prepare(
          `INSERT INTO series
             (tmdbId, title, status, posterPath, overview, firstAirDate, lastAirDate, numberOfSeasons, notes, addedAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          body.tmdbId ?? null,
          body.title,
          body.status ?? 'plantowatch',
          body.posterPath ?? null,
          body.overview ?? null,
          body.firstAirDate ?? null,
          body.lastAirDate ?? null,
          body.numberOfSeasons ?? null,
          body.notes ?? '',
          body.addedAt,
          body.updatedAt,
        ).run()
        return json({ id: result.meta.last_row_id }, 201, cors)
      }

      // /api/series/:id
      const idMatch = path.match(/^\/api\/series\/(\d+)$/)
      if (idMatch) {
        const id = parseInt(idMatch[1])

        if (method === 'GET') {
          const row = await env.DB.prepare('SELECT * FROM series WHERE id = ?').bind(id).first()
          if (!row) return json({ error: 'Not found' }, 404, cors)
          return json(row, 200, cors)
        }

        if (method === 'PATCH') {
          const body = await request.json() as Record<string, unknown>
          const filtered = Object.fromEntries(
            Object.entries(body).filter(([k]) => ALLOWED_SERIES_FIELDS.has(k))
          )
          if (Object.keys(filtered).length === 0) {
            return json({ error: 'No valid fields' }, 400, cors)
          }
          const fields = Object.keys(filtered).map(k => `${k} = ?`).join(', ')
          const values = Object.values(filtered)
          await env.DB.prepare(`UPDATE series SET ${fields} WHERE id = ?`)
            .bind(...values, id)
            .run()
          return json({ ok: true }, 200, cors)
        }

        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM watchedEpisodes WHERE seriesId = ?').bind(id).run()
          await env.DB.prepare('DELETE FROM series WHERE id = ?').bind(id).run()
          return json({ ok: true }, 200, cors)
        }
      }

      // /api/series/:id/watched
      const watchedMatch = path.match(/^\/api\/series\/(\d+)\/watched$/)
      if (watchedMatch && method === 'GET') {
        const id = parseInt(watchedMatch[1])
        const { results } = await env.DB.prepare(
          'SELECT * FROM watchedEpisodes WHERE seriesId = ? ORDER BY seasonNumber, episodeNumber'
        ).bind(id).all()
        return json(results, 200, cors)
      }

      // /api/series/:id/watched/bulk  (mark multiple episodes watched at once)
      const bulkMatch = path.match(/^\/api\/series\/(\d+)\/watched\/bulk$/)
      if (bulkMatch && method === 'POST') {
        const id = parseInt(bulkMatch[1])
        const body = await request.json() as { episodes: { seasonNumber: number; episodeNumber: number }[] }
        const now = new Date().toISOString()
        const stmts = body.episodes.map(ep =>
          env.DB.prepare(
            'INSERT OR IGNORE INTO watchedEpisodes (seriesId, seasonNumber, episodeNumber, watchedAt) VALUES (?, ?, ?, ?)'
          ).bind(id, ep.seasonNumber, ep.episodeNumber, now)
        )
        if (stmts.length > 0) await env.DB.batch(stmts)
        return json({ ok: true, count: stmts.length }, 200, cors)
      }

      // /api/series/:id/watched/season/:season  (unmark all in a season)
      const seasonMatch = path.match(/^\/api\/series\/(\d+)\/watched\/season\/(\d+)$/)
      if (seasonMatch && method === 'DELETE') {
        const id = parseInt(seasonMatch[1])
        const season = parseInt(seasonMatch[2])
        await env.DB.prepare(
          'DELETE FROM watchedEpisodes WHERE seriesId = ? AND seasonNumber = ?'
        ).bind(id, season).run()
        return json({ ok: true }, 200, cors)
      }

      // /api/series/:id/watched/toggle
      const toggleMatch = path.match(/^\/api\/series\/(\d+)\/watched\/toggle$/)
      if (toggleMatch && method === 'POST') {
        const id = parseInt(toggleMatch[1])
        const body = await request.json() as { seasonNumber: number; episodeNumber: number }
        const existing = await env.DB.prepare(
          'SELECT id FROM watchedEpisodes WHERE seriesId = ? AND seasonNumber = ? AND episodeNumber = ?'
        ).bind(id, body.seasonNumber, body.episodeNumber).first()

        if (existing) {
          await env.DB.prepare('DELETE FROM watchedEpisodes WHERE id = ?').bind(existing.id).run()
          return json({ watched: false }, 200, cors)
        }

        await env.DB.prepare(
          'INSERT INTO watchedEpisodes (seriesId, seasonNumber, episodeNumber, watchedAt) VALUES (?, ?, ?, ?)'
        ).bind(id, body.seasonNumber, body.episodeNumber, new Date().toISOString()).run()
        return json({ watched: true }, 200, cors)
      }

      // GET /api/migrations — returns all migration keys that have run
      if (path === '/api/migrations' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT key FROM migrations').all()
        return json(results.map(r => r.key), 200, cors)
      }

      // POST /api/migrations — marks a migration key as done
      if (path === '/api/migrations' && method === 'POST') {
        const body = await request.json() as { key: string }
        if (!body.key) return json({ error: 'Missing key' }, 400, cors)
        await env.DB.prepare(
          "INSERT OR IGNORE INTO migrations (key, ran_at) VALUES (?, datetime('now'))"
        ).bind(body.key).run()
        return json({ ok: true }, 200, cors)
      }

      // GET /api/stats
      if (path === '/api/stats' && method === 'GET') {
        const [totalResult, activityResult, topResult] = await Promise.all([
          env.DB.prepare('SELECT COUNT(*) as count FROM watchedEpisodes').first(),
          env.DB.prepare(
            `SELECT DATE(watchedAt) as date, COUNT(*) as count
             FROM watchedEpisodes
             WHERE watchedAt >= datetime('now', '-365 days')
             GROUP BY DATE(watchedAt)
             ORDER BY date`
          ).all(),
          env.DB.prepare(
            `SELECT w.seriesId, s.title, COUNT(*) as episodeCount
             FROM watchedEpisodes w
             JOIN series s ON w.seriesId = s.id
             GROUP BY w.seriesId
             ORDER BY episodeCount DESC
             LIMIT 5`
          ).all(),
        ])
        return json({
          totalEpisodes: (totalResult?.count as number) ?? 0,
          activityByDate: activityResult.results,
          topSeries: topResult.results,
        }, 200, cors)
      }

      // ── Movies ──────────────────────────────────────────────────────────
      // Auto-create movies table on first use (idempotent)
      async function ensureMovies() {
        await env.DB.exec(`
          CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tmdbId INTEGER,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'plantowatch',
            posterPath TEXT,
            overview TEXT,
            releaseDate TEXT,
            runtime INTEGER,
            notes TEXT NOT NULL DEFAULT '',
            imdbRating TEXT,
            addedAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          )
        `)
      }

      if (path === '/api/movies' && method === 'GET') {
        await ensureMovies()
        const { results } = await env.DB.prepare('SELECT * FROM movies ORDER BY title ASC').all()
        return json(results, 200, cors)
      }

      if (path === '/api/movies' && method === 'POST') {
        await ensureMovies()
        const body = await request.json() as Record<string, unknown>
        const result = await env.DB.prepare(
          `INSERT INTO movies (tmdbId, title, status, posterPath, overview, releaseDate, runtime, notes, imdbRating, addedAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          body.tmdbId ?? null, body.title, body.status ?? 'plantowatch',
          body.posterPath ?? null, body.overview ?? null, body.releaseDate ?? null,
          body.runtime ?? null, body.notes ?? '', body.imdbRating ?? null,
          body.addedAt, body.updatedAt,
        ).run()
        return json({ id: result.meta.last_row_id }, 201, cors)
      }

      // POST /api/movies/batch — insert many movies in one D1 batch call
      if (path === '/api/movies/batch' && method === 'POST') {
        await ensureMovies()
        const body = await request.json() as { movies: Record<string, unknown>[] }
        if (!Array.isArray(body.movies) || body.movies.length === 0) {
          return json({ inserted: 0 }, 200, cors)
        }
        const stmts = body.movies.map(m =>
          env.DB.prepare(
            `INSERT INTO movies (tmdbId, title, status, posterPath, overview, releaseDate, runtime, notes, imdbRating, addedAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            m.tmdbId ?? null, m.title, m.status ?? 'completed',
            m.posterPath ?? null, m.overview ?? null, m.releaseDate ?? null,
            m.runtime ?? null, m.notes ?? '', m.imdbRating ?? null,
            m.addedAt, m.updatedAt,
          )
        )
        await env.DB.batch(stmts)
        return json({ inserted: stmts.length }, 201, cors)
      }

      const movieIdMatch = path.match(/^\/api\/movies\/(\d+)$/)
      if (movieIdMatch) {
        const id = parseInt(movieIdMatch[1])
        await ensureMovies()

        if (method === 'GET') {
          const row = await env.DB.prepare('SELECT * FROM movies WHERE id = ?').bind(id).first()
          if (!row) return json({ error: 'Not found' }, 404, cors)
          return json(row, 200, cors)
        }

        if (method === 'PATCH') {
          const body = await request.json() as Record<string, unknown>
          const filtered = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED_MOVIE_FIELDS.has(k)))
          if (Object.keys(filtered).length === 0) return json({ error: 'No valid fields' }, 400, cors)
          const fields = Object.keys(filtered).map(k => `${k} = ?`).join(', ')
          await env.DB.prepare(`UPDATE movies SET ${fields} WHERE id = ?`).bind(...Object.values(filtered), id).run()
          return json({ ok: true }, 200, cors)
        }

        if (method === 'DELETE') {
          await env.DB.prepare('DELETE FROM movies WHERE id = ?').bind(id).run()
          return json({ ok: true }, 200, cors)
        }
      }

      return json({ error: 'Not found' }, 404, cors)
    } catch (err) {
      return json({ error: String(err) }, 500, cors)
    }
  },
}
