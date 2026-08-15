import { useState } from 'react'
import { SlidersHorizontal, GitMerge, Wand2, Grid2X2, Grid3X3, List } from 'lucide-react'
import { TVFreakIcon } from './TVFreakIcon'
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

  const viewToggleClasses = (mode: string) =>
    `p-1.5 rounded-lg transition-colors ${viewMode === mode
      ? 'bg-[#2C2C2E] text-[#F5F5F7]'
      : 'text-[#48484A] active:text-[#8E8E93]'
    }`

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div
        className="shrink-0 bg-black px-4 pb-3 z-10"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TVFreakIcon size={24} />
            <h1 className="text-xl font-bold text-[#F5F5F7]">
              Library
              <span className="ml-2 text-sm font-normal text-[#48484A]">{filtered.length}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {duplicates.length > 0 && (
              <button
                onClick={onShowDuplicates}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/8 text-amber-400/80 border border-amber-500/15 active:bg-amber-500/15 transition-colors"
              >
                <GitMerge className="w-3.5 h-3.5" />
                {duplicates.length}
              </button>
            )}
            {!migrationDone && (
              <button
                onClick={onShowMigration}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[rgba(255,159,10,0.1)] text-[#FF9F0A] border border-[rgba(255,159,10,0.2)] active:bg-[rgba(255,159,10,0.18)] transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Restore
              </button>
            )}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#48484A]" />
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="bg-transparent text-xs text-[#8E8E93] outline-none"
            >
              <option value="title" className="bg-[#111111]">A-Z</option>
              <option value="added" className="bg-[#111111]">Added</option>
              <option value="updated" className="bg-[#111111]">Updated</option>
              <option value="nextEpisode" className="bg-[#111111]">Next episode</option>
            </select>
          </div>

          <div className="flex items-center gap-0.5 bg-white/5 rounded-xl p-0.5">
            {([['big', Grid2X2], ['small', Grid3X3], ['list', List]] as const).map(([mode, Icon]) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={viewToggleClasses(mode)}>
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Filter pills — Apple-style solid chips */}
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === f.value
                  ? 'bg-[#FF9F0A] text-black'
                  : 'bg-[#2C2C2E] text-[#8E8E93] active:bg-[#383838]'
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
