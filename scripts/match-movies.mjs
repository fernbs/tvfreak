/**
 * match-movies.mjs
 * Reads Movies_List.csv, searches TMDB for each title, outputs public/movie-import.json
 *
 * Usage:
 *   node scripts/match-movies.mjs
 *
 * Reads VITE_TMDB_BEARER_TOKEN from .env automatically.
 */

// Allow corporate SSL proxy (BCG network)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = join(process.cwd(), '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

const TMDB_BEARER = process.env.VITE_TMDB_BEARER_TOKEN
if (!TMDB_BEARER) {
  console.error('VITE_TMDB_BEARER_TOKEN not found in .env or environment. Aborting.')
  process.exit(1)
}

const CSV_PATH = 'C:\\Users\\diez fernando\\OneDrive - The Boston Consulting Group, Inc\\Desktop\\Movies_List.csv'
const OUT_PATH = join(process.cwd(), 'public', 'movie-import.json')
const BATCH_DELAY_MS = 55  // ~18 req/sec, well under TMDB limit of 40/10s

// ── CSV parsing ───────────────────────────────────────────────────────────────
function parseCSV(content) {
  const lines = content.trim().split('\n')
  const seen = new Set()
  const movies = []

  for (let i = 1; i < lines.length; i++) {
    let line = lines[i].trim()
    if (!line) continue

    let title, genre
    if (line.startsWith('"')) {
      const close = line.indexOf('",')
      if (close === -1) continue
      title = line.slice(1, close)
      genre = line.slice(close + 2).trim()
    } else {
      // Find last comma (genre never contains comma)
      const ci = line.lastIndexOf(',')
      if (ci === -1) continue
      title = line.slice(0, ci).trim()
      genre = line.slice(ci + 1).trim()
    }

    if (!title) continue
    if (genre === 'Root') continue              // unreleased / unknown
    if (/S\d+E\d+/i.test(title)) continue      // TV episode files

    // Deduplicate on normalised key
    const key = title.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (seen.has(key)) continue
    seen.add(key)

    movies.push({ csvTitle: title, genre })
  }

  return movies
}

// ── Title cleaning ────────────────────────────────────────────────────────────
const FILE_META_RE = /^(.+?)\.(\d{4})\.[0-9]{3,4}p[\.\s]/i
const YEAR_PAREN_RE = /^(.+?)\s*\((\d{4})\)\s*$/
const ROMAN = /\b(I{1,3}|IV|VI{0,3}|IX|X{1,3}|XI{0,3}|XIV|XIX|XV{0,4}|XX)\b/

function cleanTitle(raw) {
  let t = raw
  let year = null

  // Remove file-download metadata: "Title.2021.1080p.BluRay..."
  const fileMeta = t.match(FILE_META_RE)
  if (fileMeta) {
    t = fileMeta[1].replace(/\./g, ' ').trim()
    year = fileMeta[2]
  }

  // Extract year from parens: "The Running Man (1987)"
  const yearParen = t.match(YEAR_PAREN_RE)
  if (yearParen) { t = yearParen[1].trim(); year = yearParen[2] }

  // For "Franchise [Roman] - Subtitle", try "Franchise Subtitle" (drop numeral+dash)
  const franchiseSub = t.match(/^(.+?)\s+[IVX]+\s+-\s+(.+)$/i)
  if (franchiseSub) {
    t = `${franchiseSub[1]} ${franchiseSub[2]}`
  }

  // Strip isolated Roman numeral suffix: "Alien I" → "Alien", "Batman III" → "Batman"
  // Only when it's the final token and no subtitle follows
  const trailingRoman = t.match(/^(.+?)\s+([IVX]+)\s*$/i)
  if (trailingRoman && ROMAN.test(trailingRoman[2])) {
    t = trailingRoman[1].trim()
  }

  return { cleaned: t.trim(), year }
}

// ── String similarity (word-Jaccard) ─────────────────────────────────────────
function norm(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function sim(a, b) {
  if (norm(a) === norm(b)) return 1
  const wa = new Set(norm(a).split(' ').filter(w => w.length > 1))
  const wb = new Set(norm(b).split(' ').filter(w => w.length > 1))
  const inter = [...wa].filter(w => wb.has(w)).length
  const union = new Set([...wa, ...wb]).size
  return union === 0 ? 0 : inter / union
}

// ── TMDB search ───────────────────────────────────────────────────────────────
async function searchTMDB(query, year) {
  const params = new URLSearchParams({ query, language: 'en-US', include_adult: 'false' })
  if (year) params.set('year', year)
  const res = await fetch(`https://api.themoviedb.org/3/search/movie?${params}`, {
    headers: { Authorization: `Bearer ${TMDB_BEARER}`, 'Content-Type': 'application/json' }
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.results || []).slice(0, 5).map(c => ({
    tmdbId: c.id,
    title: c.title,
    year: c.release_date ? c.release_date.slice(0, 4) : null,
    posterPath: c.poster_path || null,
    popularity: c.popularity || 0,
  }))
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Reading CSV…')
  const csv = readFileSync(CSV_PATH, 'utf8')
  const movies = parseCSV(csv)
  console.log(`${movies.length} unique movies after dedup\n`)

  const results = []
  let i = 0

  for (const m of movies) {
    i++
    const { cleaned, year } = cleanTitle(m.csvTitle)

    let candidates = []

    try {
      candidates = await searchTMDB(cleaned, year)
      // Fallback: if no results and title still has " - ", try just the subtitle
      if (candidates.length === 0 && cleaned.includes(' - ')) {
        const sub = cleaned.split(' - ').slice(-1)[0]
        candidates = await searchTMDB(sub, year)
      }
    } catch (e) {
      process.stderr.write(`  ERR "${cleaned}": ${e.message}\n`)
    }

    if (i % 100 === 0) process.stdout.write(`  ${i}/${movies.length}\n`)

    if (candidates.length === 0) {
      results.push({ csvTitle: m.csvTitle, status: 'no_match' })
    } else {
      const scored = candidates
        .map(c => ({ ...c, score: sim(cleaned, c.title) }))
        .sort((a, b) => b.score - a.score)

      const best = scored[0]

      if (best.score >= 0.72) {
        const { score, popularity, ...rest } = best
        results.push({ csvTitle: m.csvTitle, status: 'matched', ...rest })
      } else {
        // Present top 3 for user to pick
        results.push({
          csvTitle: m.csvTitle,
          status: 'ambiguous',
          candidates: scored.slice(0, 3).map(({ score, popularity, ...c }) => c),
        })
      }
    }

    await delay(BATCH_DELAY_MS)
  }

  const matched   = results.filter(r => r.status === 'matched').length
  const ambiguous = results.filter(r => r.status === 'ambiguous').length
  const noMatch   = results.filter(r => r.status === 'no_match').length

  console.log(`\nDone: ${matched} matched · ${ambiguous} ambiguous · ${noMatch} not found`)

  writeFileSync(OUT_PATH, JSON.stringify({ movies: results }, null, 2), 'utf8')
  console.log(`Saved → ${OUT_PATH}`)
}

main().catch(e => { console.error(e); process.exit(1) })
