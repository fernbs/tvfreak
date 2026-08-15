import { useState, type ReactNode } from 'react'
import { SlidersHorizontal, GitMerge, Wand2, Grid2X2, Grid3X3, List, Film } from 'lucide-react'
import { TVFreakIcon } from './TVFreakIcon'
import type { Series, SeriesStatus, Movie, MovieStatus } from '../types'
import { MOVIE_STATUS_CONFIG } from '../types'
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
  allMovies: Movie[]
  onMovieSelect: (m: Movie) => void
  importBanner?: ReactNode
}

function MovieGrid({ movies, loading, onSelect, viewMode }: { movies: Movie[]; loading: boolean; onSelect: (m: Movie) => void; viewMode: string }) {
  if (loading) {
    return (
      <div className={`pt-2 ${viewMode === 'big' ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-3 gap-2.5'}`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] rounded-2xl bg-[#111111] animate-pulse" />
        ))}
      </div>
    )
  }
  if (movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <Film className="w-8 h-8 text-[#48484A] mb-3" />
        <p className="text-[#8E8E93] text-base font-medium">No films yet</p>
        <p className="text-[#48484A] text-sm mt-1">Search to add films to your watchlist</p>
      </div>
    )
  }
  if (viewMode === 'list') {
    return (
      <div className="space-y-2 pt-2">
        {movies.map(m => {
          const cfg = MOVIE_STATUS_CONFIG[m.status]
          const poster = m.posterPath ? `https://image.tmdb.org/t/p/w185${m.posterPath}` : null
          return (
            <button
              key={m.id ?? m.tmdbId}
              onClick={() => onSelect(m)}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#111111] rounded-xl border border-white/7 active:bg-[#1C1C1E] transition-colors text-left"
            >
              <div className="w-[3px] self-stretch rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
              <div className="w-9 h-[52px] rounded-lg overflow-hidden bg-[#1C1C1E] shrink-0">
                {poster && <img src={poster} alt={m.title} className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#F5F5F7] truncate">{m.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.color + '25', color: cfg.color }}>
                    {cfg.label}
                  </span>
                  {m.releaseDate && <span className="text-[10px] text-[#48484A]">{m.releaseDate.slice(0, 4)}</span>}
                </div>
              </div>
              {m.imdbRating && (
                <span className="text-xs shrink-0"><span className="text-[#BF5AF2]">★</span><span className="text-white"> {m.imdbRating}</span></span>
              )}
            </button>
          )
        })}
      </div>
    )
  }
  return (
    <div className={`pt-2 ${viewMode === 'big' ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-3 gap-2.5'}`}>
      {movies.map(m => {
        const cfg = MOVIE_STATUS_CONFIG[m.status]
        const poster = m.posterPath ? `https://image.tmdb.org/t/p/w342${m.posterPath}` : null
        return (
          <div
            key={m.id ?? m.tmdbId}
            onClick={() => onSelect(m)}
            className="relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer group select-none"
            style={{ transform: 'translateZ(0)' }}
          >
            {poster ? (
              <img src={poster} alt={m.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.06]" draggable={false} />
            ) : (
              <div className="w-full h-full bg-[#1C1C1E] flex items-center justify-center p-3">
                <span className="text-xs text-[#48484A] text-center leading-snug font-medium">{m.title}</span>
              </div>
            )}
            {/* Crescent arc — status indicator */}
            <div
              className="absolute pointer-events-none"
              style={{
                bottom: -22,
                left: -22,
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: `2.5px solid ${cfg.color}`,
              }}
            />
            {/* Rating */}
            {m.imdbRating && (
              <div className="absolute bottom-1.5 right-1.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-black/75 leading-tight backdrop-blur-sm">
                <span className="text-[#BF5AF2]">★</span>
                <span className="text-white"> {m.imdbRating}</span>
              </div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
              <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{m.title}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
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
  allMovies, onMovieSelect,
  importBanner,
}: Props) {
  const [filter, setFilter] = useState<SeriesStatus | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('title')
  const [viewMode, setViewMode] = useViewMode()
  const [mediaMode, setMediaMode] = useState<'tv' | 'movie'>('tv')
  const [movieFilter, setMovieFilter] = useState<MovieStatus | 'all'>('all')

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

  const filteredMovies = [...allMovies]
    .filter(m => movieFilter === 'all' || m.status === movieFilter)
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'added') return b.addedAt.getTime() - a.addedAt.getTime()
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })

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
            <h1 className="text-xl font-bold text-[#F5F5F7]">Library</h1>
          </div>
          <div className="flex items-center gap-2">
            {duplicates.length > 0 && (
              <button
                onClick={onShowDuplicates}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[rgba(191,90,242,0.08)] text-[#BF5AF2]/80 border border-[rgba(191,90,242,0.15)] active:bg-[rgba(191,90,242,0.15)] transition-colors"
              >
                <GitMerge className="w-3.5 h-3.5" />
                {duplicates.length}
              </button>
            )}
            {!migrationDone && (
              <button
                onClick={onShowMigration}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[rgba(191,90,242,0.1)] text-[#BF5AF2] border border-[rgba(191,90,242,0.2)] active:bg-[rgba(191,90,242,0.18)] transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Restore
              </button>
            )}
          </div>
        </div>

        {/* Series / Films tab bar */}
        <div className="flex border-b border-white/6 mb-3 -mx-4 px-4">
          {([['tv', 'Series', series.length], ['movie', 'Films', allMovies.length]] as const).map(([mode, label, count]) => {
            const isActive = mediaMode === mode
            return (
              <button
                key={mode}
                onClick={() => setMediaMode(mode)}
                className="flex-1 flex flex-col items-center pb-2.5 pt-1 relative transition-colors"
              >
                <span className={`text-sm font-semibold transition-colors ${isActive ? 'text-[#F5F5F7]' : 'text-[#48484A]'}`}>
                  {label}
                </span>
                <span className={`text-[11px] font-medium transition-colors ${isActive ? 'text-[#BF5AF2]' : 'text-[#48484A]'}`}>
                  {count}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-10 bg-[#BF5AF2] rounded-full" />
                )}
              </button>
            )
          })}
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
              {mediaMode === 'tv' && (
                <option value="nextEpisode" className="bg-[#111111]">Next episode</option>
              )}
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
        {mediaMode === 'tv' && (
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === f.value
                    ? 'bg-[#BF5AF2] text-white'
                    : 'bg-[#2C2C2E] text-[#8E8E93] active:bg-[#383838]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        {mediaMode === 'movie' && (
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {([['all', 'All'], ['plantowatch', 'Watchlist'], ['watching', 'Watching'], ['completed', 'Watched'], ['dropped', 'Dropped']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setMovieFilter(val as MovieStatus | 'all')}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  movieFilter === val
                    ? 'bg-[#BF5AF2] text-white'
                    : 'bg-[#2C2C2E] text-[#8E8E93] active:bg-[#383838]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto overscroll-contain pb-6 min-h-0">
        {importBanner && mediaMode === 'movie' && (
          <div className="pt-3">{importBanner}</div>
        )}
        <div className="px-4">
          {mediaMode === 'tv' ? (
            <SeriesGrid series={filtered} loading={loading} onSelect={onSelect} viewMode={viewMode} />
          ) : (
            <MovieGrid movies={filteredMovies} loading={false} onSelect={onMovieSelect} viewMode={viewMode} />
          )}
        </div>
      </div>
    </div>
  )
}
