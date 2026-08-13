import type { Series } from '../types'
import { STATUS_CONFIG } from '../types'
import type { SeriesStatus } from '../types'

interface Props {
  series: Series[]
  activeFilter: SeriesStatus | 'all'
  onFilter: (f: SeriesStatus | 'all') => void
}

export function StatsBar({ series, activeFilter, onFilter }: Props) {
  const total = series.length
  const counts: Record<SeriesStatus, number> = {
    watching: series.filter(s => s.status === 'watching').length,
    completed: series.filter(s => s.status === 'completed').length,
    dropped: series.filter(s => s.status === 'dropped').length,
    plantowatch: series.filter(s => s.status === 'plantowatch').length,
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onFilter('all')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          activeFilter === 'all'
            ? 'bg-white/10 text-white'
            : 'text-white/50 hover:text-white hover:bg-white/5'
        }`}
      >
        All
        <span className="ml-1.5 text-white/40 text-xs">{total}</span>
      </button>

      {(Object.entries(STATUS_CONFIG) as [SeriesStatus, typeof STATUS_CONFIG[SeriesStatus]][]).map(
        ([status, config]) => (
          <button
            key={status}
            onClick={() => onFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeFilter === status
                ? `${config.bgClass} ${config.textClass}`
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {config.label}
            <span className="ml-1.5 text-white/40 text-xs">{counts[status]}</span>
          </button>
        )
      )}
    </div>
  )
}
