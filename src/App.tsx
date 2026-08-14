import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { getAllSeries, deduplicateSeries, getDuplicates, updateSeries } from './lib/api'
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
    } catch { /* worker unreachable, keep empty state */ }
    finally { setLoading(false) }
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
