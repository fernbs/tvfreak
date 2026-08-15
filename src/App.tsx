import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { getAllSeries, deduplicateSeries, getDuplicates, updateSeries, getWatchedEpisodes, unmarkSeasonEpisodes } from './lib/api'
import type { DuplicateGroup } from './lib/api'
import { importFromCsv } from './lib/import'
import { getTvDetails, getSeasonEpisodes } from './lib/tmdb'
import { toast } from 'sonner'
import type { Series } from './types'
import { BottomNav } from './components/BottomNav'
import type { Tab } from './components/BottomNav'
import { HomeTab } from './components/HomeTab'
import { LibraryTab } from './components/LibraryTab'
import { SearchTab } from './components/SearchTab'
import { StatsTab } from './components/StatsTab'
import { DetailPanel } from './components/DetailPanel'
import { ImportBanner } from './components/ImportBanner'
import { DuplicateModal } from './components/DuplicateModal'
import { MigrationModal, MIGRATION_KEY } from './components/MigrationModal'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [workerError, setWorkerError] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 })
  const [selected, setSelected] = useState<Series | null>(null)

  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [showMigration, setShowMigration] = useState(false)
  const [migrationDone, setMigrationDone] = useState(() => localStorage.getItem(MIGRATION_KEY) === 'true')

  // Auto-dismiss migration banner if data already exists in the DB
  useEffect(() => {
    if (allSeries.length > 0 && !migrationDone) {
      localStorage.setItem(MIGRATION_KEY, 'true')
      setMigrationDone(true)
    }
  }, [allSeries.length, migrationDone])

  const loadSeries = useCallback(async () => {
    try {
      const data = await getAllSeries()
      setAllSeries(data)
      setWorkerError(false)
    } catch {
      setWorkerError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      if (!localStorage.getItem('tvfreak-csv-import-done')) {
        try {
          setImporting(true)
          await importFromCsv((done, total) => setImportProgress({ done, total }))
          localStorage.setItem('tvfreak-csv-import-done', 'true')
        } catch { /* import file not found or failed, skip silently */ }
        finally { setImporting(false) }
      }
      try { await deduplicateSeries() } catch { /* non-fatal */ }
      await loadSeries()
      try {
        const dupes = await getDuplicates()
        setDuplicates(dupes)
      } catch { /* non-fatal */ }
    }
    init()
  }, [loadSeries])

  const refreshNextEpisodeDates = useCallback(async () => {
    const all = await getAllSeries()
    const now = new Date()
    const toRefresh = all.filter(s =>
      s.tmdbId && s.id &&
      (s.status === 'watching' || s.status === 'plantowatch') &&
      (!s.nextEpisodeDate || new Date(s.nextEpisodeDate) <= now || !s.futureDates)
    )
    if (toRefresh.length === 0) { await loadSeries(); return }
    const todayStr = new Date().toISOString().slice(0, 10)
    for (const s of toRefresh) {
      try {
        const detail = await getTvDetails(s.tmdbId!)
        if (!detail) continue
        const rating = (detail.vote_average ?? 0) > 0 ? detail.vote_average!.toFixed(1) : null

        // Collect all known future dates: next episode + upcoming season premieres + individual episode dates
        const futureDatesSet = new Set<string>()
        // Include future seasons AND the currently-airing season (which may have unreleased episodes)
        const activeSeasonNumber = detail.next_episode_to_air?.season_number ?? null
        const upcomingSeasons = detail.seasons.filter(
          season => season.season_number > 0 && (
            !season.air_date ||
            season.air_date > todayStr ||
            season.season_number === activeSeasonNumber
          )
        )
        // Season premiere dates (future only)
        for (const season of upcomingSeasons) {
          if (season.air_date && season.air_date > todayStr) futureDatesSet.add(season.air_date)
        }
        // Fetch individual episode dates for upcoming + active seasons (run in parallel per series)
        const episodeLists = await Promise.all(
          upcomingSeasons.map(season => getSeasonEpisodes(detail.id, season.season_number).catch(() => []))
        )
        for (const episodes of episodeLists) {
          for (const ep of episodes) {
            if (ep.air_date && ep.air_date > todayStr) futureDatesSet.add(ep.air_date)
          }
        }
        if (detail.next_episode_to_air?.air_date && detail.next_episode_to_air.air_date > todayStr) {
          futureDatesSet.add(detail.next_episode_to_air.air_date)
        }
        const futureDates = [...futureDatesSet].sort()

        const updates: Parameters<typeof updateSeries>[1] = {
          nextEpisodeDate: detail.next_episode_to_air?.air_date ?? null,
          nextEpisodeName: detail.next_episode_to_air?.name ?? null,
          futureDates: futureDates.length > 0 ? futureDates : null,
          ...(rating ? { imdbRating: rating } : {}),
        }
        await updateSeries(s.id!, updates)
      } catch { /* ignore */ }
      await new Promise(r => setTimeout(r, 300))
    }
    await loadSeries()
  }, [loadSeries])

  useEffect(() => {
    if (loading) return
    refreshNextEpisodeDates()
  }, [loading, refreshNextEpisodeDates])

  // Daily: notify when a completed show has new episodes coming — status stays 'completed' so Fernando decides
  useEffect(() => {
    if (loading) return
    const lastCheck = parseInt(localStorage.getItem('tvfreak-revival-checked-ts') ?? '0')
    if (Date.now() - lastCheck < 24 * 60 * 60 * 1000) return
    localStorage.setItem('tvfreak-revival-checked-ts', String(Date.now()))
    async function checkRevived() {
      const all = await getAllSeries()
      const completedSeries = all.filter(s => s.tmdbId && s.id && s.status === 'completed')
      let changed = false
      for (const s of completedSeries) {
        try {
          const detail = await getTvDetails(s.tmdbId!)
          if (!detail) continue
          if (detail.next_episode_to_air) {
            // Update the date so it shows in Upcoming, but keep status as 'completed'
            await updateSeries(s.id!, {
              nextEpisodeDate: detail.next_episode_to_air.air_date,
              nextEpisodeName: detail.next_episode_to_air.name,
            })
            toast(`${s.title} is back — new episodes coming. Change status if you want to track it.`, { duration: 7000 })
            changed = true
          } else if (detail.status === 'Returning Series' || detail.status === 'In Production') {
            toast(`${s.title} has a new season confirmed.`, { duration: 5000 })
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 500))
      }
      if (changed) await loadSeries()
    }
    checkRevived()
  }, [loading, loadSeries])

  // Daily: auto-flip "watching" series where all episodes are watched
  useEffect(() => {
    if (loading) return
    const lastCheck = parseInt(localStorage.getItem('tvfreak-status-check-ts-v2') ?? '0')
    if (Date.now() - lastCheck < 24 * 60 * 60 * 1000) return
    localStorage.setItem('tvfreak-status-check-ts-v2', String(Date.now()))
    async function checkWatchingStatus() {
      const all = await getAllSeries()
      const watching = all.filter(s => s.tmdbId && s.id && s.status === 'watching')
      if (watching.length === 0) return
      let changed = false
      for (const s of watching) {
        try {
          const [detail, watched] = await Promise.all([
            getTvDetails(s.tmdbId!),
            getWatchedEpisodes(s.id!),
          ])
          if (!detail) continue
          const today = new Date().toISOString().slice(0, 10)
          const airedSeasons = detail.seasons
            .filter(season => season.season_number > 0)
            .filter(season => season.air_date != null && season.air_date <= today)
          // For the currently-active season, use last_episode_to_air.episode_number as the
          // released count rather than season.episode_count (which includes unaired episodes).
          // For all older completed seasons, episode_count is accurate.
          const activeSeasonNumber = detail.last_episode_to_air?.season_number ?? null
          const totalEpisodes = airedSeasons.reduce((sum, season) => {
            if (activeSeasonNumber && season.season_number === activeSeasonNumber && detail.last_episode_to_air) {
              return sum + detail.last_episode_to_air.episode_number
            }
            return sum + season.episode_count
          }, 0)
          if (totalEpisodes === 0) {
            // No episodes have aired yet — series should be pending, not watching
            const nextEp = detail.next_episode_to_air
            if (nextEp) {
              await updateSeries(s.id!, { status: 'plantowatch', nextEpisodeDate: nextEp.air_date, nextEpisodeName: nextEp.name })
            } else {
              await updateSeries(s.id!, { status: 'plantowatch' })
            }
            changed = true
            continue
          }
          const airedSeasonNumbers = new Set(airedSeasons.map(s => s.season_number))
          const watchedCount = watched.filter(w => w.seasonNumber > 0 && airedSeasonNumbers.has(w.seasonNumber)).length
          if (watchedCount >= totalEpisodes) {
            const isReturning = detail.status === 'Returning Series' || detail.status === 'In Production'
            if (detail.next_episode_to_air) {
              await updateSeries(s.id!, {
                status: 'plantowatch',
                nextEpisodeDate: detail.next_episode_to_air.air_date,
                nextEpisodeName: detail.next_episode_to_air.name,
              })
              toast(`All caught up on ${s.title}! New episodes coming.`, { duration: 5000 })
            } else if (isReturning) {
              await updateSeries(s.id!, { status: 'plantowatch', nextEpisodeDate: null, nextEpisodeName: null })
              toast(`All caught up on ${s.title}! Waiting for new season.`, { duration: 4000 })
            } else {
              await updateSeries(s.id!, { status: 'completed' })
              toast.success(`${s.title} marked as completed.`, { duration: 5000 })
            }
            changed = true
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 400))
      }
      if (changed) await loadSeries()
    }
    checkWatchingStatus()
  }, [loading, loadSeries])

  // Once-per-session: remove watched episodes that are in seasons that haven't aired yet
  useEffect(() => {
    if (loading) return
    if (sessionStorage.getItem('unreleased-cleanup-done')) return
    sessionStorage.setItem('unreleased-cleanup-done', '1')
    async function cleanupUnreleasedWatched() {
      const all = await getAllSeries()
      const eligible = all.filter(s => s.tmdbId && s.id)
      let changed = false
      const today = new Date().toISOString().slice(0, 10)
      for (const s of eligible) {
        try {
          const watched = await getWatchedEpisodes(s.id!)
          if (watched.length === 0) continue
          const detail = await getTvDetails(s.tmdbId!)
          if (!detail) continue
          const watchedSeasons = new Set(watched.filter(w => w.seasonNumber > 0).map(w => w.seasonNumber))
          for (const season of detail.seasons) {
            const sn = season.season_number
            if (sn <= 0 || !watchedSeasons.has(sn)) continue
            // Season hasn't started airing: all watched entries in it are wrong
            if (season.air_date && season.air_date > today) {
              await unmarkSeasonEpisodes(s.id!, sn)
              changed = true
            }
          }
        } catch { /* ignore per-series errors */ }
        await new Promise(r => setTimeout(r, 400))
      }
      if (changed) await loadSeries()
    }
    cleanupUnreleasedWatched()
  }, [loading, loadSeries])

  // Once-ever: backfill ratings for watching/plantowatch series that were missed because
  // refreshNextEpisodeDates skips them when nextEpisodeDate is still valid (no stale date = no TMDB call).
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('tvfreak-ratings-watching-v1')) return
    async function populateWatchingRatings() {
      const all = await getAllSeries()
      const toRate = all.filter(s =>
        s.tmdbId && s.id && !s.imdbRating &&
        (s.status === 'watching' || s.status === 'plantowatch')
      )
      for (const s of toRate) {
        try {
          const detail = await getTvDetails(s.tmdbId!)
          if ((detail?.vote_average ?? 0) > 0) {
            await updateSeries(s.id!, { imdbRating: detail!.vote_average!.toFixed(1) })
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 250))
      }
      localStorage.setItem('tvfreak-ratings-watching-v1', 'true')
      if (toRate.length > 0) await loadSeries()
    }
    populateWatchingRatings()
  }, [loading, loadSeries])

  // Once-ever: populate TMDB ratings for completed/dropped series
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('tvfreak-ratings-populated-v1')) return
    async function populateRatings() {
      const all = await getAllSeries()
      const toRate = all.filter(s =>
        s.tmdbId && s.id && !s.imdbRating &&
        (s.status === 'completed' || s.status === 'dropped')
      )
      for (const s of toRate) {
        try {
          const detail = await getTvDetails(s.tmdbId!)
          if ((detail?.vote_average ?? 0) > 0) {
            await updateSeries(s.id!, { imdbRating: detail!.vote_average!.toFixed(1) })
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 250))
      }
      localStorage.setItem('tvfreak-ratings-populated-v1', 'true')
      if (toRate.length > 0) await loadSeries()
    }
    populateRatings()
  }, [loading, loadSeries])

  // DEAD JOB — already ran on all devices (key: tvfreak-fix-completed-v1).
  // Do NOT change the logic or the key — it would re-run on any device that hasn't seen it.
  // What it did: changed completed+returning shows → watching. Was too broad; caused collateral
  // damage (Fargo, Black Mirror, etc. got bumped). checkRevived now handles this without auto-flipping status.
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('tvfreak-fix-completed-v1')) return
    async function fixCompletedReturning() {
      const all = await getAllSeries()
      const completed = all.filter(s => s.tmdbId && s.id && s.status === 'completed')
      let changed = false
      for (const s of completed) {
        try {
          const detail = await getTvDetails(s.tmdbId!)
          if (!detail) continue
          if (detail.status === 'Returning Series' || detail.status === 'In Production') {
            await updateSeries(s.id!, {
              status: 'watching',
              nextEpisodeDate: detail.next_episode_to_air?.air_date ?? null,
              nextEpisodeName: detail.next_episode_to_air?.name ?? null,
            })
            changed = true
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 300))
      }
      localStorage.setItem('tvfreak-fix-completed-v1', 'true')
      if (changed) await loadSeries()
    }
    fixCompletedReturning()
  }, [loading, loadSeries])

  // Once-ever: for series imported without a poster, backfill ALL available TMDB info
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('tvfreak-content-backfill-v1')) return
    async function backfillSeriesInfo() {
      const all = await getAllSeries()
      const incomplete = all.filter(s => s.tmdbId && s.id && !s.posterPath)
      for (const s of incomplete) {
        try {
          const detail = await getTvDetails(s.tmdbId!)
          if (!detail) continue
          const updates: Parameters<typeof updateSeries>[1] = {}
          if (detail.poster_path) updates.posterPath = detail.poster_path
          if (detail.overview) updates.overview = detail.overview
          if (detail.first_air_date) updates.firstAirDate = detail.first_air_date
          if (detail.last_air_date) updates.lastAirDate = detail.last_air_date
          if (detail.number_of_seasons) updates.numberOfSeasons = detail.number_of_seasons
          if (!s.imdbRating && (detail.vote_average ?? 0) > 0) {
            updates.imdbRating = detail.vote_average!.toFixed(1)
          }
          if (!s.nextEpisodeDate && detail.next_episode_to_air) {
            updates.nextEpisodeDate = detail.next_episode_to_air.air_date
            updates.nextEpisodeName = detail.next_episode_to_air.name
          }
          if (Object.keys(updates).length > 0) {
            await updateSeries(s.id!, updates)
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 250))
      }
      localStorage.setItem('tvfreak-content-backfill-v1', 'true')
    }
    backfillSeriesInfo()
  }, [loading, loadSeries])

  // DEAD JOB — already ran on all devices (key: tvfreak-watching-fix-v1).
  // Do NOT change the logic or the key. What it did: changed plantowatch+aired → watching.
  // Was too broad — also caught shows imported from Simkl as plantowatch that Fernando
  // considered dropped. v2 below catches anything this missed due to missing firstAirDate.
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('tvfreak-watching-fix-v1')) return
    async function fixPendingToWatching() {
      const all = await getAllSeries()
      const today = new Date().toISOString().slice(0, 10)
      const toFix = all.filter(s =>
        s.id &&
        s.status === 'plantowatch' &&
        s.firstAirDate &&
        s.firstAirDate <= today
      )
      if (toFix.length === 0) { localStorage.setItem('tvfreak-watching-fix-v1', 'true'); return }
      for (const s of toFix) {
        try {
          await updateSeries(s.id!, { status: 'watching' })
        } catch { /* ignore */ }
      }
      localStorage.setItem('tvfreak-watching-fix-v1', 'true')
      await loadSeries()
    }
    fixPendingToWatching()
  }, [loading, loadSeries])

  // DEAD JOB (v2) — already ran on all devices (key: tvfreak-watching-fix-v2).
  // Do NOT change the logic or the key. Catches plantowatch series v1 missed (e.g. HotD,
  // whose firstAirDate wasn't stored yet when v1 ran).
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('tvfreak-watching-fix-v2')) return
    async function fixPendingToWatchingV2() {
      const all = await getAllSeries()
      const today = new Date().toISOString().slice(0, 10)
      const toFix = all.filter(s =>
        s.id &&
        s.status === 'plantowatch' &&
        s.firstAirDate &&
        s.firstAirDate <= today
      )
      if (toFix.length === 0) { localStorage.setItem('tvfreak-watching-fix-v2', 'true'); return }
      for (const s of toFix) {
        try {
          await updateSeries(s.id!, { status: 'watching' })
        } catch { /* ignore */ }
      }
      localStorage.setItem('tvfreak-watching-fix-v2', 'true')
      await loadSeries()
    }
    fixPendingToWatchingV2()
  }, [loading, loadSeries])

  // Once-ever: unmark all watched episodes in seasons that premiered in 2026
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('tvfreak-unmark-2026-v1')) return
    async function unmark2026Seasons() {
      const all = await getAllSeries()
      const eligible = all.filter(s => s.tmdbId && s.id)
      let changed = false
      for (const s of eligible) {
        try {
          const detail = await getTvDetails(s.tmdbId!)
          if (!detail) continue
          const seasons2026 = detail.seasons.filter(
            season => season.season_number > 0 && season.air_date?.startsWith('2026')
          )
          for (const season of seasons2026) {
            await unmarkSeasonEpisodes(s.id!, season.season_number)
            changed = true
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 400))
      }
      localStorage.setItem('tvfreak-unmark-2026-v1', 'true')
      if (changed) await loadSeries()
    }
    unmark2026Seasons()
  }, [loading, loadSeries])

  // Once-ever v2: re-run 2026 unmark for watching/plantowatch series (catches series whose status changed after v1 ran)
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('tvfreak-unmark-2026-v2')) return
    async function unmark2026SeasonsV2() {
      const all = await getAllSeries()
      const eligible = all.filter(s => s.tmdbId && s.id && s.status !== 'dropped' && s.status !== 'completed')
      for (const s of eligible) {
        try {
          const detail = await getTvDetails(s.tmdbId!)
          if (!detail) continue
          const seasons2026 = detail.seasons.filter(
            season => season.season_number > 0 && season.air_date?.startsWith('2026')
          )
          for (const season of seasons2026) {
            await unmarkSeasonEpisodes(s.id!, season.season_number)
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 400))
      }
      localStorage.setItem('tvfreak-unmark-2026-v2', 'true')
    }
    unmark2026SeasonsV2()
  }, [loading, loadSeries])

  // Once-ever: flip 'watching' series that have no released episodes yet to 'plantowatch'
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('tvfreak-pending-fix-v1')) return
    async function fixWatchingNothingAired() {
      const all = await getAllSeries()
      const watching = all.filter(s => s.tmdbId && s.id && s.status === 'watching')
      let changed = false
      const today = new Date().toISOString().slice(0, 10)
      for (const s of watching) {
        try {
          const detail = await getTvDetails(s.tmdbId!)
          if (!detail) continue
          const airedSeasons = detail.seasons
            .filter(season => season.season_number > 0)
            .filter(season => season.air_date != null && season.air_date <= today)
          const activeSeasonNumber = detail.last_episode_to_air?.season_number ?? null
          const totalEpisodes = airedSeasons.reduce((sum, season) => {
            if (activeSeasonNumber && season.season_number === activeSeasonNumber && detail.last_episode_to_air) {
              return sum + detail.last_episode_to_air.episode_number
            }
            return sum + season.episode_count
          }, 0)
          if (totalEpisodes === 0) {
            const nextEp = detail.next_episode_to_air
            if (nextEp) {
              await updateSeries(s.id!, { status: 'plantowatch', nextEpisodeDate: nextEp.air_date, nextEpisodeName: nextEp.name })
            } else {
              await updateSeries(s.id!, { status: 'plantowatch' })
            }
            changed = true
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 300))
      }
      localStorage.setItem('tvfreak-pending-fix-v1', 'true')
      if (changed) await loadSeries()
    }
    fixWatchingNothingAired()
  }, [loading, loadSeries])

  async function handleSeriesUpdated() {
    const data = await getAllSeries()
    setAllSeries(data)
    setLoading(false)
    if (selected?.id) {
      const fresh = data.find(s => s.id === selected.id)
      if (fresh) setSelected(fresh)
    }
  }

  async function handleSeriesAdded() {
    await loadSeries()
  }

  async function handleDuplicateResolved() {
    await loadSeries()
    const dupes = await getDuplicates()
    setDuplicates(dupes)
  }

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] overflow-hidden">
      {/* Worker unreachable banner */}
      {workerError && !loading && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border-b border-red-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <p className="text-xs text-red-400 flex-1">Can't reach the server. Your data is safe — check your Cloudflare Worker is running.</p>
          <button
            onClick={loadSeries}
            className="text-xs text-red-400/70 underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tab content */}
      <main className="flex-1 overflow-hidden min-h-0">
        {tab === 'home' && (
          <HomeTab series={allSeries} loading={loading} onSelect={setSelected} onRefresh={refreshNextEpisodeDates} />
        )}
        {tab === 'library' && (
          <LibraryTab
            series={allSeries}
            loading={loading}
            onSelect={setSelected}
            duplicates={duplicates}
            onShowDuplicates={() => setShowDuplicates(true)}
            migrationDone={migrationDone}
            onShowMigration={() => setShowMigration(true)}
          />
        )}
        {tab === 'search' && (
          <SearchTab onSeriesAdded={handleSeriesAdded} allSeries={allSeries} onSelect={setSelected} />
        )}
        {tab === 'stats' && (
          <StatsTab allSeries={allSeries} />
        )}
      </main>

      {/* Bottom navigation */}
      <BottomNav active={tab} onChange={setTab} />

      {/* Overlays */}
      <DetailPanel
        series={selected}
        onClose={() => setSelected(null)}
        onUpdated={handleSeriesUpdated}
      />

      {importing && (
        <ImportBanner done={importProgress.done} total={importProgress.total} />
      )}

      <AnimatePresence>
        {showDuplicates && (
          <DuplicateModal
            groups={duplicates}
            onClose={() => setShowDuplicates(false)}
            onResolved={handleDuplicateResolved}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMigration && (
          <MigrationModal
            onClose={() => setShowMigration(false)}
            onDone={loadSeries}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
