import { useState } from 'react'
import { Tv, Calendar } from 'lucide-react'
import type { Series } from '../types'
import { SeriesCard } from './SeriesCard'
import { formatAirDate } from '../lib/utils'
import { posterUrl } from '../lib/tmdb'

interface Props {
  series: Series[]
  loading: boolean
  onSelect: (s: Series) => void
}

export function HomeTab({ series, loading, onSelect }: Props) {
  const [view, setView] = useState<'watching' | 'upcoming'>('watching')

  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const watchingNow = series
    .filter(s => s.status === 'plantowatch')
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  const upcoming = series
    .filter(s => {
      if (!s.nextEpisodeDate) return false
      const d = new Date(s.nextEpisodeDate)
      return d >= now && d <= in30Days
    })
    .sort((a, b) => new Date(a.nextEpisodeDate!).getTime() - new Date(b.nextEpisodeDate!).getTime())

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div
        className="shrink-0 px-4 pb-3 bg-[#0A0A0A]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)' }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Tv className="w-5 h-5 text-[#6366F1]" />
          <span className="text-lg font-bold tracking-tight text-white">TVFREAK</span>
        </div>

        {/* Toggle */}
        <div className="flex bg-white/6 rounded-xl p-1 gap-1">
          <button
            onClick={() => setView('watching')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'watching' ? 'bg-white/10 text-white' : 'text-white/40'
            }`}
          >
            Watching now
          </button>
          <button
            onClick={() => setView('upcoming')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'upcoming' ? 'bg-white/10 text-white' : 'text-white/40'
            }`}
          >
            Upcoming
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 min-h-0">
        {loading ? (
          <p className="text-sm text-white/25 py-12 text-center">Loading...</p>
        ) : view === 'watching' ? (
          watchingNow.length === 0 ? (
            <div className="py-16 text-center">
              <Tv className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/25">No series marked as Pending yet.</p>
              <p className="text-xs text-white/15 mt-1">Add series from the Search tab.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              {watchingNow.map(s => (
                <SeriesCard key={s.id} series={s} onClick={onSelect} />
              ))}
            </div>
          )
        ) : (
          upcoming.length === 0 ? (
            <div className="py-16 text-center">
              <Calendar className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/25">No episodes airing in the next 30 days.</p>
              <p className="text-xs text-white/15 mt-1">Open a series to refresh its next episode date.</p>
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              {upcoming.map(s => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s)}
                  className="w-full flex items-center gap-3 p-3 bg-[#141414] rounded-xl border border-white/6 active:bg-white/5 transition-colors text-left"
                >
                  <div className="w-10 h-14 rounded-lg overflow-hidden bg-[#1E1E1E] shrink-0">
                    {s.posterPath && (
                      <img
                        src={posterUrl(s.posterPath, 'w185') ?? ''}
                        alt={s.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{s.title}</p>
                    {s.nextEpisodeName && (
                      <p className="text-xs text-white/40 mt-0.5 truncate">{s.nextEpisodeName}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-[#6366F1]">
                      {formatAirDate(s.nextEpisodeDate)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
