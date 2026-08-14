import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { getAllSeries, deduplicateSeries, getDuplicates, updateSeries } from './lib/api'
import type { DuplicateGroup } from './lib/api'
import { importFromCsv } from './lib/import'
import { getTvDetails } from './lib/tmdb'
import type { Series } from './types'
import { BottomNav } from './components/BottomNav'
import type { Tab } from './components/BottomNav'
import { HomeTab } from './components/HomeTab'
import { LibraryTab } from './components/LibraryTab'
import { SearchTab } from './components/SearchTab'
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
    const data = await getAllSeries()
    setAllSeries(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    async function init() {
      setImporting(true)
      await importFromCsv((done, total) => setImportProgress({ done, total }))
      setImporting(false)
      await deduplicateSeries()
      await loadSeries()
      const dupes = await getDuplicates()
      setDuplicates(dupes)
    }
    init()
  }, [loadSeries])

  useEffect(() => {
    if (loading) return
    async function refreshNextEpisodeDates() {
      const all = await getAllSeries()
      const now = new Date()
      const toRefresh = all.filter(s =>
        s.tmdbId && s.id &&
        (s.status === 'watching' || s.status === 'plantowatch') &&
        (!s.nextEpisodeDate || new Date(s.nextEpisodeDate) <= now)
      )
      if (toRefresh.length === 0) return
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
    }
    refreshNextEpisodeDates()
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
          <HomeTab series={allSeries} loading={loading} onSelect={setSelected} />
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
          <SearchTab onSeriesAdded={handleSeriesAdded} allSeries={allSeries} />
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
