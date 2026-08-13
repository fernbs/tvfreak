import { useState, useEffect, useCallback } from 'react'
import { Tv, SlidersHorizontal } from 'lucide-react'
import { getAllSeries, deduplicateSeries } from './lib/api'
import { importFromCsv } from './lib/import'
import type { Series, SeriesStatus } from './types'
import { SeriesGrid } from './components/SeriesGrid'
import { DetailPanel } from './components/DetailPanel'
import { SearchBar } from './components/SearchBar'
import { StatsBar } from './components/StatsBar'
import { ImportBanner } from './components/ImportBanner'

type SortKey = 'title' | 'added' | 'updated'

export default function App() {
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 })
  const [selected, setSelected] = useState<Series | null>(null)
  const [filter, setFilter] = useState<SeriesStatus | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('title')

  const loadSeries = useCallback(async () => {
    const data = await getAllSeries()
    setAllSeries(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    async function init() {
      await deduplicateSeries()
      setImporting(true)
      await importFromCsv((done, total) => {
        setImportProgress({ done, total })
      })
      setImporting(false)
      await loadSeries()
    }
    init()
  }, [loadSeries])

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

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Tv className="w-5 h-5 text-[#6366F1]" />
            <span className="text-base font-bold tracking-tight text-white">TVFREAK</span>
          </div>

          <div className="flex-1" />

          <SearchBar onSeriesAdded={handleSeriesAdded} />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {/* Filter + sort bar */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <StatsBar
            series={allSeries}
            activeFilter={filter}
            onFilter={setFilter}
          />

          <div className="flex items-center gap-2 shrink-0">
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

        <SeriesGrid
          series={filtered}
          loading={loading}
          onSelect={setSelected}
        />
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
    </div>
  )
}
