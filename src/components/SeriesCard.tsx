import type { Series } from '../types'
import { STATUS_CONFIG } from '../types'
import { posterUrl } from '../lib/tmdb'
import { formatAirDate } from '../lib/utils'

interface Props {
  series: Series
  onClick: (series: Series) => void
}

export function SeriesCard({ series, onClick }: Props) {
  const config = STATUS_CONFIG[series.status]
  const poster = posterUrl(series.posterPath, 'w342')
  const now = new Date()
  const hasUpcoming = series.nextEpisodeDate && new Date(series.nextEpisodeDate) > now
  const isComplete = series.status === 'completed' && !hasUpcoming

  return (
    <div
      onClick={() => onClick(series)}
      className="relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer group select-none"
      style={{ transform: 'translateZ(0)' }}
    >
      {poster ? (
        <img
          src={poster}
          alt={series.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full bg-[#1E1E1E] flex items-center justify-center p-3 transition-transform duration-300 group-hover:scale-[1.03]">
          <span className="text-xs text-white/40 text-center leading-snug font-medium">
            {series.title}
          </span>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
        <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{series.title}</p>
        <span
          className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: config.color + '25', color: config.color }}
        >
          {config.label}
        </span>
      </div>

      {/* Upcoming episode badge — top left */}
      {hasUpcoming && series.nextEpisodeDate && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#6366F1]/90 text-white leading-tight backdrop-blur-sm">
          {formatAirDate(series.nextEpisodeDate)}
        </div>
      )}

      {/* Complete chip — top right */}
      {isComplete && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/80 text-white leading-tight backdrop-blur-sm">
          Complete
        </div>
      )}

      {/* Status bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{ backgroundColor: config.color }}
      />
    </div>
  )
}
