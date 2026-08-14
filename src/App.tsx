import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { getAllSeries, deduplicateSeries, getDuplicates, updateSeries, getWatchedEpisodes, unmarkSeasonEpisodes } from './lib/api'
import type { DuplicateGroup } from './lib/api'
import { importFromCsv } from './lib/import'
import { getTvDetails } from './lib/tmdb'
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
  const migrationDone = localStorage.getItem(MIGRATION_KEY) === 'true'

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
      try {
        setImporting(true)
        await importFromCsv((done, total) => setImportProgress({ done, total }))
      } catch { /* import file not found or failed, skip silently */ }
      finally { setImporting(false) }
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
      (!s.nextEpisodeDate || new Date(s.nextEpisodeDate) <= now)
    )
    if (toRefresh.length === 0) { await loadSeries(); return }
    for (const s of toRefresh) {
      try {
        const detail = await getTvDetails(s.tmdbId!)
        if (detail?.next_episode_to_air) {
          await updateSeries(s.id!, {
            nextEpisodeDate: detail.next_episode_to_air.air_date,
            nextEpisodeName: detail.next_episode_to_air.name,
          })
        } else {
          await updateSeries(s.id!, { nextEpisodeDate: null, nextEpisodeName: null })
        }
      } catch { /* ignore */ }
      await new Promise(r => setTimeout(r, 300))
    }
    await loadSeries()
  }, [loadSeries])

  useEffect(() => {
    if (loading) return
    refreshNextEpisodeDates()
  }, [loading, refreshNextEpisodeDates])

  // Once-per-session check for cancelled shows that have been revived
  useEffect(() => {
    if (loading) return
    if (sessionStorage.getItem('revival-checked')) return
    sessionStorage.setItem('revival-checked', '1')
    async function checkRevived() {
      const all = await getAllSeries()
      const completedSeries = all.filter(s => s.tmdbId && s.id && s.status === 'completed')
      for (const s of completedSeries) {
        try {
          const detail = await getTvDetails(s.tmdbId!)
          if (detail?.next_episode_to_air) {
            await updateSeries(s.id!, {
              status: 'plantowatch',
              nextEpisodeDate: detail.next_episode_to_air.air_date,
              nextEpisodeName: detail.next_episode_to_air.name,
            })
            toast(`${s.title} is back! New episodes are coming.`, { duration: 6000 })
          }
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 500))
      }
      await loadSeries()
    }
    checkRevived()
  }, [loading, loadSeries])

  // Once-per-session: auto-flip "watching" series where all episodes are watched
  useEffect(() => {
    if (loading) return
    if (sessionStorage.getItem('watching-status-checked')) return
    sessionStorage.setItem('watching-status-checked', '1')
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
          const totalEpisodes = airedSeasons.reduce((sum, season) => sum + season.episode_count, 0)
          if (totalEpisodes === 0) continue
          const airedSeasonNumbers = new Set(airedSeasons.map(s => s.season_number))
          const watchedCount = watched.filter(w => w.seasonNumber > 0 && airedSeasonNumbers.has(w.seasonNumber)).length
          if (watchedCount >= totalEpisodes) {
            if (detail.next_episode_to_air) {
              await updateSeries(s.id!, {
                status: 'plantowatch',
                nextEpisodeDate: detail.next_episode_to_air.air_date,
                nextEpisodeName: detail.next_episode_to_air.name,
              })
              toast(`All caught up on ${s.title}! New episodes coming.`, { duration: 5000 })
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
