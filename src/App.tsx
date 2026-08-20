import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Settings, Grid2X2, Grid3X3, List } from 'lucide-react'
import { useViewMode, type ViewMode } from './lib/useViewMode'
import { getAllSeries, deduplicateSeries, getDuplicates, updateSeries, getWatchedEpisodes, unmarkSeasonEpisodes, preloadMigrations, isMigrationDone, markMigration, getAllMovies, deduplicateMovies, updateMovie } from './lib/api'
import type { DuplicateGroup } from './lib/api'
import { importFromCsv } from './lib/import'
import { getTvDetails, getSeasonEpisodes, getExternalIds, getMovieExternalIds, getRatings } from './lib/tmdb'
import { toast } from 'sonner'
import type { Series, Movie } from './types'
import { BottomNav } from './components/BottomNav'
import type { Tab } from './components/BottomNav'
import { HomeTab } from './components/HomeTab'
import { LibraryTab } from './components/LibraryTab'
import { SearchTab } from './components/SearchTab'
import { StatsTab } from './components/StatsTab'
import { DiscoverTab } from './components/DiscoverTab'
import { DetailPanel } from './components/DetailPanel'
import { MovieDetailPanel } from './components/MovieDetailPanel'
import { ImportBanner } from './components/ImportBanner'
import { DuplicateModal } from './components/DuplicateModal'
import { MigrationModal, MIGRATION_KEY } from './components/MigrationModal'
import { MovieImportBanner, MovieImportSheet, useMovieImport } from './components/MovieImportSheet'
import { SettingsModal } from './components/SettingsModal'
import { TVFreakIcon } from './components/TVFreakIcon'

const TAB_TITLES: Record<Tab, string> = {
  home: 'TVFREAK',
  library: 'Library',
  search: 'Search',
  stats: 'Stats',
  discover: 'Discover',
}

const GRID_TABS: Tab[] = ['home', 'search', 'library']

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [showSettings, setShowSettings] = useState(false)
  const [homeViewMode, setHomeViewMode] = useViewMode('tvfreak-view-mode-home')
  const [libraryViewMode, setLibraryViewMode] = useViewMode('tvfreak-view-mode-library')
  const [searchViewMode, setSearchViewMode] = useViewMode('tvfreak-view-mode-search')
  const viewModeMap = { home: homeViewMode, library: libraryViewMode, search: searchViewMode } as const
  const setViewModeMap = { home: setHomeViewMode, library: setLibraryViewMode, search: setSearchViewMode } as const
  const viewMode = viewModeMap[tab as keyof typeof viewModeMap] ?? homeViewMode
  const setViewMode = setViewModeMap[tab as keyof typeof setViewModeMap] ?? setHomeViewMode
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [workerError, setWorkerError] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 })
  const [seriesStack, setSeriesStack] = useState<Series[]>([])
  const selected = seriesStack[seriesStack.length - 1] ?? null
  const [allMovies, setAllMovies] = useState<Movie[]>([])
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null)

  const movieImport = useMovieImport(allMovies.length)

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

  const loadMovies = useCallback(async () => {
    try {
      const data = await getAllMovies()
      setAllMovies(data)
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    // Safety net: if network calls hang, clear loading after 12 s
    const safetyTimer = setTimeout(() => setLoading(false), 12000)

    async function init() {
      // Preload DB migration state once so all per-device jobs can check it.
      // This prevents jobs from re-running on new devices when the DB already
      // shows they completed on a previous device.
      await preloadMigrations()

      const CSV_KEY = 'tvfreak-csv-import-done'
      if (!(await isMigrationDone(CSV_KEY))) {
        try {
          setImporting(true)
          await importFromCsv((done, total) => setImportProgress({ done, total }))
          await markMigration(CSV_KEY)
        } catch { /* import file not found or failed, skip silently */ }
        finally { setImporting(false) }
      }
      try { await deduplicateSeries() } catch { /* non-fatal */ }
      try { await deduplicateMovies() } catch { /* non-fatal */ }
      await loadSeries()
      loadMovies()
      try {
        const dupes = await getDuplicates()
        setDuplicates(dupes)
      } catch { /* non-fatal */ }
    }
    init().finally(() => clearTimeout(safetyTimer))
  }, [loadSeries, loadMovies])

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
          ...(rating && !s.imdbRating ? { imdbRating: rating } : {}),
        }
        // Promote plantowatch → watching when the series is actively airing
        if (
          s.status === 'plantowatch' &&
          detail.last_episode_to_air &&
          detail.next_episode_to_air
        ) {
          updates.status = 'watching'
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

  // Once-ever: fetch real OMDB/IMDB ratings for movies that have none
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('tvfreak-movie-ratings-v1')) return
    async function populateMovieRatings() {
      const all = await getAllMovies()
      const toRate = all.filter(m => m.tmdbId && m.id && !m.imdbRating)
      for (const m of toRate) {
        try {
          const ext = await getMovieExternalIds(m.tmdbId!)
          if (ext.imdb_id) {
            const { imdb, rt } = await getRatings(ext.imdb_id)
            const updates: Partial<Movie> = {}
            if (imdb) updates.imdbRating = imdb
            if (rt) updates.rtRating = rt
            if (Object.keys(updates).length > 0) await updateMovie(m.id!, updates)
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 300))
      }
      localStorage.setItem('tvfreak-movie-ratings-v1', 'true')
      if (toRate.length > 0) await loadMovies()
    }
    populateMovieRatings()
  }, [loading, loadMovies])

  // Once-ever: fetch real OMDB/RT ratings for series that have none
  useEffect(() => {
    if (loading) return
    if (localStorage.getItem('tvfreak-series-rt-ratings-v1')) return
    async function populateSeriesRtRatings() {
      const all = await getAllSeries()
      const toRate = all.filter(s => s.tmdbId && s.id && !s.rtRating)
      for (const s of toRate) {
        try {
          const ext = await getExternalIds(s.tmdbId!)
          if (ext.imdb_id) {
            const { rt, imdb } = await getRatings(ext.imdb_id)
            const updates: Partial<Series> = {}
            if (rt) updates.rtRating = rt
            if (imdb && !s.imdbRating) updates.imdbRating = imdb
            if (Object.keys(updates).length > 0) await updateSeries(s.id!, updates)
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 300))
      }
      localStorage.setItem('tvfreak-series-rt-ratings-v1', 'true')
      if (toRate.length > 0) await loadSeries()
    }
    populateSeriesRtRatings()
  }, [loading, loadSeries])

  // DEAD JOB — logic removed. Key preserved so it doesn't re-run on new devices.
  // What it did: changed completed+returning shows → watching. Caused collateral damage.
  useEffect(() => {
    if (loading) return
    markMigration('tvfreak-fix-completed-v1')
  }, [loading])

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

  // DEAD JOBs — logic removed. Keys preserved so they never re-run on any device.
  // watching-fix-v1/v2: changed plantowatch+aired → watching (too broad).
  // unmark-2026-v1/v2: deleted watched episodes in 2026 seasons (one-time data fix, done).
  useEffect(() => {
    if (loading) return
    markMigration('tvfreak-watching-fix-v1')
    markMigration('tvfreak-watching-fix-v2')
    markMigration('tvfreak-unmark-2026-v1')
    markMigration('tvfreak-unmark-2026-v2')
  }, [loading])

  // Once-ever: flip 'watching' series that have no released episodes yet to 'plantowatch'.
  // DB-tracked so it runs exactly once across all devices.
  useEffect(() => {
    if (loading) return
    async function fixWatchingNothingAired() {
      if (await isMigrationDone('tvfreak-pending-fix-v1')) return
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
      await markMigration('tvfreak-pending-fix-v1')
      if (changed) await loadSeries()
    }
    fixWatchingNothingAired()
  }, [loading, loadSeries])

  // Once-ever: fix 'watching' series whose firstAirDate is still in the future (added before the status-on-add fix)
  useEffect(() => {
    if (loading) return
    async function fixFutureWatching() {
      if (await isMigrationDone('tvfreak-fix-future-watching-v1')) return
      const all = await getAllSeries()
      const today = new Date().toISOString().slice(0, 10)
      const toFix = all.filter(s => s.id && s.status === 'watching' && s.firstAirDate && s.firstAirDate > today)
      for (const s of toFix) {
        await updateSeries(s.id!, { status: 'plantowatch' })
      }
      await markMigration('tvfreak-fix-future-watching-v1')
      if (toFix.length > 0) await loadSeries()
    }
    fixFutureWatching()
  }, [loading, loadSeries])

  function openSeries(s: Series) { setSeriesStack([s]) }
  function pushSeries(s: Series) { setSeriesStack(prev => [...prev, s]) }
  function popSeries() { setSeriesStack(prev => prev.slice(0, -1)) }

  async function handleSeriesUpdated() {
    const data = await getAllSeries()
    setAllSeries(data)
    setLoading(false)
    setSeriesStack(prev => {
      if (prev.length === 0) return prev
      const top = prev[prev.length - 1]
      if (!top?.id) return prev
      const fresh = data.find(s => s.id === top.id)
      return fresh ? [...prev.slice(0, -1), fresh] : prev
    })
  }

  async function handleSeriesAdded() {
    await loadSeries()
  }

  async function handleMovieUpdated() {
    const data = await getAllMovies()
    setAllMovies(data)
    if (selectedMovie?.id) {
      const fresh = data.find(m => m.id === selectedMovie.id)
      if (fresh) setSelectedMovie(fresh)
    }
  }

  async function handleMovieAdded() {
    await loadMovies()
  }

  async function handleDuplicateResolved() {
    await loadSeries()
    const dupes = await getDuplicates()
    setDuplicates(dupes)
  }

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {/* Global persistent header */}
      <div
        className="shrink-0 flex items-center justify-between px-4 pb-3 bg-black"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <div className="flex items-center gap-2">
          <TVFreakIcon size={24} />
          <span className="text-xl font-bold tracking-tight text-[#F5F5F7]">{TAB_TITLES[tab]}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {GRID_TABS.includes(tab) && (
            <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
              {([['big', Grid2X2], ['small', Grid3X3], ['list', List]] as [ViewMode, typeof Grid2X2][]).map(([mode, Icon]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === mode ? 'bg-[#2C2C2E] text-[#F5F5F7]' : 'text-[#48484A]'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 flex items-center justify-center rounded-xl active:bg-white/5 transition-colors"
          >
            <Settings className="w-[18px] h-[18px] text-[#48484A]" />
          </button>
        </div>
      </div>

      {/* Worker unreachable banner */}
      {workerError && !loading && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-rose-500/8 border-b border-rose-500/15">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
          <p className="text-xs text-rose-400/90 flex-1">Can't reach the server. Your data is safe — check your Cloudflare Worker is running.</p>
          <button
            onClick={loadSeries}
            className="text-xs text-rose-400/60 underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tab content */}
      <main className="flex-1 overflow-hidden min-h-0">
        {tab === 'home' && (
          <HomeTab series={allSeries} loading={loading} onSelect={openSeries} allMovies={allMovies} onMovieSelect={setSelectedMovie} viewMode={viewMode} />
        )}
        {tab === 'library' && (
          <LibraryTab
            series={allSeries}
            loading={loading}
            onSelect={openSeries}
            duplicates={duplicates}
            onShowDuplicates={() => setShowDuplicates(true)}
            migrationDone={migrationDone}
            onShowMigration={() => setShowMigration(true)}
            allMovies={allMovies}
            onMovieSelect={setSelectedMovie}
            viewMode={viewMode}
            importBanner={movieImport.showBanner ? (
              <MovieImportBanner onOpen={movieImport.openSheet} count={movieImport.matchCount} />
            ) : null}
          />
        )}
        {tab === 'search' && (
          <SearchTab
            onSeriesAdded={handleSeriesAdded}
            allSeries={allSeries}
            onSelect={openSeries}
            allMovies={allMovies}
            onMovieAdded={handleMovieAdded}
            onMovieSelect={setSelectedMovie}
            viewMode={viewMode}
          />
        )}
        {tab === 'stats' && (
          <StatsTab allSeries={allSeries} allMovies={allMovies} />
        )}
        {tab === 'discover' && (
          <DiscoverTab
            allSeries={allSeries}
            allMovies={allMovies}
            onSeriesAdded={handleSeriesAdded}
            onMovieAdded={handleMovieAdded}
          />
        )}
      </main>

      {/* Bottom navigation */}
      <BottomNav active={tab} onChange={setTab} />

      {/* Overlays */}
      <DetailPanel
        series={selected}
        onClose={popSeries}
        onUpdated={handleSeriesUpdated}
        onSelect={pushSeries}
      />

      <MovieDetailPanel
        movie={selectedMovie}
        onClose={() => setSelectedMovie(null)}
        onUpdated={handleMovieUpdated}
        onSelect={setSelectedMovie}
      />

      {importing && (
        <ImportBanner done={importProgress.done} total={importProgress.total} />
      )}

      {movieImport.sheetOpen && (
        <MovieImportSheet
          onClose={movieImport.closeSheet}
          onImportDone={() => { movieImport.onImportDone(); loadMovies() }}
        />
      )}

      <AnimatePresence>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </AnimatePresence>

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
