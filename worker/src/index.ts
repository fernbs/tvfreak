interface Env {
  DB: D1Database
}

const ALLOWED_SERIES_FIELDS = new Set([
  'tmdbId', 'title', 'status', 'posterPath', 'overview',
  'firstAirDate', 'lastAirDate', 'numberOfSeasons', 'notes',
  'addedAt', 'updatedAt',
])

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

      // POST /api/series/deduplicate
      if (path === '/api/series/deduplicate' && method === 'POST') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM series ORDER BY id ASC'
        ).all()

        const seen = new Map<string, { id: number; posterPath: unknown; tmdbId: unknown }>()
        const toDelete: number[] = []

        for (const s of results) {
          const key = (s.title as string).toLowerCase().trim()
          const id = s.id as number
          const existing = seen.get(key)

          if (!existing) {
            seen.set(key, { id, posterPath: s.posterPath, tmdbId: s.tmdbId })
          } else {
            const existingScore = (existing.posterPath ? 1 : 0) + (existing.tmdbId ? 1 : 0)
            const currentScore = (s.posterPath ? 1 : 0) + (s.tmdbId ? 1 : 0)
            if (existingScore >= currentScore) {
              toDelete.push(id)
            } else {
              toDelete.push(existing.id)
              seen.set(key, { id, posterPath: s.posterPath, tmdbId: s.tmdbId })
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

      return json({ error: 'Not found' }, 404, cors)
    } catch (err) {
      return json({ error: String(err) }, 500, cors)
    }
  },
}
