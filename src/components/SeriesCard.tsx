import type { Series } from '../types'
import { STATUS_CONFIG } from '../types'
import { posterUrl } from '../lib/tmdb'

interface Props {
  series: Series
  onClick: (series: Series) => void
}

export function SeriesCard({ series, onClick }: Props) {
  const config = STATUS_CONFIG[series.status]
  const poster = posterUrl(series.posterPath, 'w342')

  return (
    <div
      onClick={() => onClick(series)}
      className="relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer group select-none"
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
        <p className="text-white text-sm font-semibold leading-tight line-clamp-2">{series.title}</p>
        <span
          className="inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: config.color + '25', color: config.color }}
        >
          {config.label}
        </span>
      </div>

      {/* Status bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{ backgroundColor: config.color }}
      />
    </div>
  )
}
