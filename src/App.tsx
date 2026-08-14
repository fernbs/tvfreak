import { useState, useEffect, useCallback } from 'react'
import { Tv, SlidersHorizontal, Wand2, GitMerge } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { getAllSeries, deduplicateSeries, getDuplicates, updateSeries } from './lib/api'
import type { DuplicateGroup } from './lib/api'
import { importFromCsv } from './lib/import'
import { getTvDetails } from './lib/tmdb'
import type { Series, SeriesStatus } from './types'
import { SeriesGrid } from './components/SeriesGrid'
import { SeriesCard } from './components/SeriesCard'
import { DetailPanel } from './components/DetailPanel'
import { SearchBar } from './components/SearchBar'
import { StatsBar } from './components/StatsBar'
import { ImportBanner } from './components/ImportBanner'
import { DuplicateModal } from './components/DuplicateModal'
import { MigrationModal, MIGRATION_KEY } from './components/MigrationModal'

type SortKey = 'title' | 'added' | 'updated'
type View = 'home' | 'library'

export default function App() {
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 })
  const [selected, setSelected] = useState<Series | null>(null)
  const [filter, setFilter] = useState<SeriesStatus | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('title')
  const [view, setView] = useState<View>('home')

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
      await importFromCsv((done, total) => {
        setImportProgress({ done, total })
      })
      setImporting(false)
      await deduplicateSeries()
      await loadSeries()
      // Check for remaining duplicates (fuzzy — not caught by exact dedup)
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

  function sorted(series: Series[]): Series[] {
    return [...series].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'added') return b.addedAt.getTime() - a.addedAt.getTime()
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })
  }

  const filtered = sorted(
    filter === 'all' ? allSeries : allSeries.filter(s => s.status === filter)
  )

  const watchingNow = [...allSeries]
    .filter(s => s.status === 'watching' || s.status === 'plantowatch')
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  const now = new Date()
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const upcomingEpisodes = [...allSeries]
    .filter(s => {
      if (!s.nextEpisodeDate) return false
      const d = new Date(s.nextEpisodeDate)
      return d >= now && d <= in14Days
    })
    .sort((a, b) => new Date(a.nextEpisodeDate!).getTime() - new Date(b.nextEpisodeDate!).getTime())

  async function handleSeriesUpdated() {
    await loadSeries()
    if (selected?.id) {
      const fresh = allSeries.find(s => s.id === selected.id)
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
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Tv className="w-5 h-5 text-[#6366F1]" />
            <span className="text-base font-bold tracking-tight text-white">TVFREAK</span>
          </div>

          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setView('home')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view === 'home' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setView('library')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                view === 'library' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              Library
            </button>
          </div>

          <div className="flex-1" />

          <SearchBar onSeriesAdded={handleSeriesAdded} />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {view === 'home' ? (
          <div className="space-y-10">
            {/* Currently Watching */}
            <section>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
                Watching now
              </h2>
              {loading ? (
                <p className="text-sm text-white/25">Loading...</p>
              ) : watchingNow.length === 0 ? (
                <p className="text-sm text-white/25">No series marked as Watching or Pending yet.</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                  {watchingNow.map(s => (
                    <div key={s.id} className="w-[108px] shrink-0">
                      <SeriesCard series={s} onClick={setSelected} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Upcoming episodes */}
            <section>
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
                New episodes this fortnight
              </h2>
              {loading ? (
                <p className="text-sm text-white/25">Loading...</p>
              ) : upcomingEpisodes.length === 0 ? (
                <p className="text-sm text-white/25">
                  Nothing airing in the next 14 days. Open a series to refresh its next episode date.
                </p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                  {upcomingEpisodes.map(s => (
                    <div key={s.id} className="w-[108px] shrink-0">
                      <SeriesCard series={s} onClick={setSelected} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <>
            {/* Filter + sort bar */}
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <StatsBar
                series={allSeries}
                activeFilter={filter}
                onFilter={setFilter}
              />

              <div className="flex items-center gap-3 shrink-0">
                {/* Tools */}
                {duplicates.length > 0 && (
                  <button
                    onClick={() => setShowDuplicates(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/20"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    {duplicates.length} duplicate{duplicates.length !== 1 ? 's' : ''}
                  </button>
                )}
                {!migrationDone && (
                  <button
                    onClick={() => setShowMigration(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#6366F1]/10 text-[#6366F1] hover:bg-[#6366F1]/20 transition-colors border border-[#6366F1]/20"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Restore history
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-white/30" />
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value as SortKey)}
                    className="bg-transparent text-sm text-white/50 outline-none cursor-pointer hover:text-white/80 transition-colors"
                  >
                    <option value="title" className="bg-[#1E1E1E]">A-Z</option>
                    <option value="added" className="bg-[#1E1E1E]">Recently Added</option>
                    <option value="updated" className="bg-[#1E1E1E]">Last Updated</option>
                  </select>
                </div>
              </div>
            </div>

            <SeriesGrid
              series={filtered}
              loading={loading}
              onSelect={setSelected}
            />
          </>
        )}
      </main>

      <DetailPanel
        series={selected}
        onClose={() => setSelected(null)}
        onUpdated={handleSeriesUpdated}
      />

      {importing && (
        <ImportBanner
          done={importProgress.done}
          total={importProgress.total}
        />
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
