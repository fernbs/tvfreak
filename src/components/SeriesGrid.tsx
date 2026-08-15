import type { Series } from '../types'
import { STATUS_CONFIG } from '../types'
import { SeriesCard } from './SeriesCard'
import { SkeletonCard } from './SkeletonCard'
import { posterUrl } from '../lib/tmdb'
import { formatAirDate } from '../lib/utils'
import type { ViewMode } from '../lib/useViewMode'

interface Props {
  series: Series[]
  loading: boolean
  onSelect: (series: Series) => void
  viewMode?: ViewMode
}

export function SeriesGrid({ series, loading, onSelect, viewMode = 'small' }: Props) {
  if (loading) {
    if (viewMode === 'list') {
      return (
        <div className="space-y-2 pt-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-[72px] bg-[#111111] rounded-xl animate-pulse border border-white/5" />
          ))}
        </div>
      )
    }
    return (
      <div className={`pt-2 ${viewMode === 'big' ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-3 gap-2.5'}`}>
        {Array.from({ length: 18 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (series.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-[#8E8E93] text-base font-medium">Nothing here yet</p>
        <p className="text-[#48484A] text-sm mt-1">Use the search tab to add your first series</p>
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-2 pt-2">
        {series.map(s => {
          const config = STATUS_CONFIG[s.status]
          const poster = posterUrl(s.posterPath, 'w185')
          const now = new Date()
          const hasUpcoming = s.nextEpisodeDate && new Date(s.nextEpisodeDate) > now
          return (
            <button
              key={s.id ?? s.tmdbId}
              onClick={() => onSelect(s)}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#111111] rounded-xl border border-white/7 active:bg-[#1C1C1E] transition-colors text-left"
            >
              <div className="w-[3px] self-stretch rounded-full shrink-0" style={{ backgroundColor: config.color }} />
              <div className="w-9 h-[52px] rounded-lg overflow-hidden bg-[#1C1C1E] shrink-0">
                {poster && (
                  <img src={poster} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F5F5F7] truncate">{s.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: config.color + '25', color: config.color }}
                  >
                    {config.label}
                  </span>
                  {hasUpcoming && s.nextEpisodeDate && (
                    <span className="text-[10px] text-[#48484A] truncate">
                      {formatAirDate(s.nextEpisodeDate)}
                    </span>
                  )}
                  {!hasUpcoming && s.status === 'plantowatch' && !s.nextEpisodeDate && (
                    <span className="text-[10px] text-[#48484A]">TBA</span>
                  )}
                </div>
              </div>
              {s.imdbRating && (
                <span className="text-xs shrink-0"><span className="text-[#BF5AF2]">★</span><span className="text-white"> {s.imdbRating}</span></span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`pt-2 ${viewMode === 'big' ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5'}`}>
      {series.map(s => (
        <SeriesCard key={s.id ?? s.tmdbId} series={s} onClick={onSelect} />
      ))}
    </div>
  )
}
