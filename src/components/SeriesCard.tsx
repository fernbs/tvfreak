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
  const hasNewEpisode =
    series.nextEpisodeDate &&
    new Date(series.nextEpisodeDate) <= now &&
    (series.status === 'watching' || series.status === 'plantowatch')

  return (
    <div
      onClick={() => onClick(series)}
      className="relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer group select-none"
      style={{ transform: 'translateZ(0)' }}
    >
      {poster ? (
        <img
          src={poster}
          alt={series.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full bg-[#1C1C1E] flex items-center justify-center p-3 transition-transform duration-300 group-hover:scale-[1.06]">
          <span className="text-xs text-[#48484A] text-center leading-snug font-medium">
            {series.title}
          </span>
        </div>
      )}

      {/* Bottom-left corner status gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at 0% 100%, ${config.color}70 0%, transparent 38%)` }}
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
        <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{series.title}</p>
        <span
          className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: config.color + '30', color: config.color }}
        >
          {config.label}
        </span>
      </div>

      {/* Upcoming episode date badge */}
      {hasUpcoming && series.nextEpisodeDate && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#BF5AF2]/90 text-white leading-tight backdrop-blur-sm">
          {formatAirDate(series.nextEpisodeDate)}
        </div>
      )}

      {/* Pending + no known date: TBA badge */}
      {!hasUpcoming && !hasNewEpisode && series.status === 'plantowatch' && !series.nextEpisodeDate && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-black/60 text-[#8E8E93] leading-tight backdrop-blur-sm">
          TBA
        </div>
      )}

      {/* New episode aired badge */}
      {hasNewEpisode && !hasUpcoming && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#BF5AF2]/90 text-white leading-tight backdrop-blur-sm">
          New
        </div>
      )}

      {/* Complete chip */}
      {isComplete && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/80 text-white leading-tight backdrop-blur-sm">
          Complete
        </div>
      )}

      {/* Rating */}
      {series.imdbRating && (
        <div className="absolute bottom-1.5 right-1.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-black/75 leading-tight backdrop-blur-sm">
          <span className="text-[#BF5AF2]">★</span>
          <span className="text-white"> {series.imdbRating}</span>
        </div>
      )}
    </div>
  )
}
