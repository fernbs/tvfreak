import { useState } from 'react'
import { SlidersHorizontal, GitMerge, Wand2, Grid2X2, Grid3X3, List } from 'lucide-react'
import type { Series, SeriesStatus } from '../types'
import type { DuplicateGroup } from '../lib/api'
import { SeriesGrid } from './SeriesGrid'
import { useViewMode } from '../lib/useViewMode'

type SortKey = 'title' | 'added' | 'updated' | 'nextEpisode'

interface Props {
  series: Series[]
  loading: boolean
  onSelect: (s: Series) => void
  duplicates: DuplicateGroup[]
  onShowDuplicates: () => void
  migrationDone: boolean
  onShowMigration: () => void
}

const FILTERS: { label: string; value: SeriesStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'plantowatch' },
  { label: 'Watching', value: 'watching' },
  { label: 'Completed', value: 'completed' },
  { label: 'Dropped', value: 'dropped' },
]

export function LibraryTab({
  series, loading, onSelect,
  duplicates, onShowDuplicates,
  migrationDone, onShowMigration,
}: Props) {
  const [filter, setFilter] = useState<SeriesStatus | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('title')
  const [viewMode, setViewMode] = useViewMode()

  function sorted(list: Series[]): Series[] {
    return [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'added') return b.addedAt.getTime() - a.addedAt.getTime()
      if (sort === 'nextEpisode') {
        const aDate = a.nextEpisodeDate ? new Date(a.nextEpisodeDate).getTime() : Infinity
        const bDate = b.nextEpisodeDate ? new Date(b.nextEpisodeDate).getTime() : Infinity
        return aDate - bDate
      }
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })
  }

  const filtered = sorted(filter === 'all' ? series : series.filter(s => s.status === filter))

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div
        className="shrink-0 bg-[#0A0A0A] px-4 pb-3 z-10"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)' }}
      >
        {/* Title row */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-white">
            Library
            <span className="ml-2 text-sm font-normal text-white/30">{filtered.length}</span>
          </h1>
          <div className="flex items-center gap-2">
            {duplicates.length > 0 && (
              <button
                onClick={onShowDuplicates}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 active:bg-amber-500/20 transition-colors"
              >
                <GitMerge className="w-3.5 h-3.5" />
                {duplicates.length}
              </button>
            )}
            {!migrationDone && (
              <button
                onClick={onShowMigration}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20 active:bg-[#6366F1]/20 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Restore
              </button>
            )}
          </div>
        </div>

        {/* Controls row: sort + view toggle */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-white/25" />
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="bg-transparent text-xs text-white/40 outline-none"
            >
              <option value="title" className="bg-[#1E1E1E]">A-Z</option>
              <option value="added" className="bg-[#1E1E1E]">Added</option>
              <option value="updated" className="bg-[#1E1E1E]">Updated</option>
              <option value="nextEpisode" className="bg-[#1E1E1E]">Next episode</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-white/6 rounded-lg p-0.5">
            {([['big', Grid2X2], ['small', Grid3X3], ['list', List]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-1.5 rounded-md transition-colors ${viewMode === mode ? 'bg-white/12 text-white' : 'text-white/30'}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f.value
                  ? 'bg-[#6366F1] text-white'
                  : 'bg-white/6 text-white/45 active:bg-white/12'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 min-h-0">
        <SeriesGrid series={filtered} loading={loading} onSelect={onSelect} viewMode={viewMode} />
      </div>
    </div>
  )
}
