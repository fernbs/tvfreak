import { useState, useEffect, type ReactNode } from 'react'
import { SlidersHorizontal, GitMerge, Wand2, Film, X, Loader2 } from 'lucide-react'
import type { Series, SeriesStatus, Movie, MovieStatus, WatchProvider } from '../types'
import { MOVIE_STATUS_CONFIG } from '../types'
import type { DuplicateGroup } from '../lib/api'
import { getStreamingProviders, getMovieStreamingProviders, IMG_BASE } from '../lib/tmdb'
import { getDefaultProviders, getCountry } from '../lib/settings'
import { SeriesGrid } from './SeriesGrid'
import type { ViewMode } from '../lib/useViewMode'

type SortKey = 'title' | 'added' | 'updated' | 'nextEpisode'

const RATING_OPTIONS = [null, 5, 6, 7, 8] as const
const TV_STATUS_FILTERS: { label: string; value: SeriesStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'plantowatch' },
  { label: 'Watching', value: 'watching' },
  { label: 'Completed', value: 'completed' },
  { label: 'Dropped', value: 'dropped' },
]
const MOVIE_STATUS_FILTERS: { label: string; value: MovieStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Watchlist', value: 'plantowatch' },
  { label: 'Watching', value: 'watching' },
  { label: 'Watched', value: 'completed' },
  { label: 'Dropped', value: 'dropped' },
]

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
  viewMode: ViewMode
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
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(circle at 0% 100%, ${cfg.color}99 0%, transparent 38%)` }}
            />
            <div
              className="absolute pointer-events-none"
              style={{ bottom: 0, left: 0, width: 16, height: 16, borderLeft: `2px solid ${cfg.color}`, borderBottom: `2px solid ${cfg.color}`, borderBottomLeftRadius: 16 }}
            />
            {m.imdbRating && (
              <div className="absolute bottom-1.5 right-1.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-black/75 leading-tight backdrop-blur-sm">
                <span className="text-[#BF5AF2]">★</span>
                <span className="text-white"> {m.imdbRating}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5">
              <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{m.title}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LibraryTab({
  series, loading, onSelect,
  duplicates, onShowDuplicates,
  migrationDone, onShowMigration,
  allMovies, onMovieSelect,
  viewMode, importBanner,
}: Props) {
  const [filter, setFilter] = useState<SeriesStatus | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('title')
  const [mediaMode, setMediaMode] = useState<'tv' | 'movie'>('tv')
  const [movieFilter, setMovieFilter] = useState<MovieStatus | 'all'>('all')
  const [minRating, setMinRating] = useState<number | null>(null)
  const [showFilterSheet, setShowFilterSheet] = useState(false)
  const [filterPlatforms, setFilterPlatforms] = useState<number[]>(getDefaultProviders)
  const [availableProviders, setAvailableProviders] = useState<WatchProvider[]>([])
  const [loadingProviders, setLoadingProviders] = useState(false)

  useEffect(() => {
    const country = getCountry()
    setLoadingProviders(true)
    const fetchFn = mediaMode === 'tv' ? getStreamingProviders : getMovieStreamingProviders
    fetchFn(country).then(providers => {
      setAvailableProviders(providers)
      const available = new Set(providers.map((p: WatchProvider) => p.provider_id))
      setFilterPlatforms(getDefaultProviders().filter(id => available.has(id)))
    }).finally(() => setLoadingProviders(false))
  }, [mediaMode])

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

  const filtered = sorted(
    (filter === 'all' ? series : series.filter(s => s.status === filter))
      .filter(s => minRating == null || parseFloat(s.imdbRating ?? '0') >= minRating)
  )

  const filteredMovies = [...allMovies]
    .filter(m => movieFilter === 'all' || m.status === movieFilter)
    .filter(m => minRating == null || parseFloat(m.imdbRating ?? '0') >= minRating)
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'added') return b.addedAt.getTime() - a.addedAt.getTime()
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })

  const activeStatusFilter = mediaMode === 'tv' ? filter !== 'all' : movieFilter !== 'all'
  const activeFilterCount = [activeStatusFilter, minRating != null].filter(Boolean).length

  function clearFilters() {
    setFilter('all')
    setMovieFilter('all')
    setMinRating(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="shrink-0 bg-black px-4 pb-3 z-10">
        {/* Series / Films tab bar */}
        <div className="flex items-end border-b border-white/6 mb-3 -mx-4 px-4">
          <div className="flex flex-1">
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
          <div className="flex items-center gap-1.5 pb-2.5">
            {duplicates.length > 0 && (
              <button
                onClick={onShowDuplicates}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-[rgba(191,90,242,0.08)] text-[#BF5AF2]/80 border border-[rgba(191,90,242,0.15)] active:bg-[rgba(191,90,242,0.15)] transition-colors"
              >
                <GitMerge className="w-3 h-3" />
                {duplicates.length}
              </button>
            )}
            {!migrationDone && (
              <button
                onClick={onShowMigration}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-[rgba(191,90,242,0.1)] text-[#BF5AF2] border border-[rgba(191,90,242,0.2)] active:bg-[rgba(191,90,242,0.18)] transition-colors"
              >
                <Wand2 className="w-3 h-3" />
                Restore
              </button>
            )}
          </div>
        </div>

        {/* Controls row: sort + filter button */}
        <div className="flex items-center gap-2">
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

          <button
            onClick={() => setShowFilterSheet(true)}
            className={`ml-auto relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              activeFilterCount > 0
                ? 'bg-[rgba(191,90,242,0.08)] border-[rgba(191,90,242,0.25)] text-[#BF5AF2]'
                : 'bg-[#1C1C1E] border-white/8 text-[#8E8E93]'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3 shrink-0" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="bg-[#BF5AF2] text-white text-[9px] font-bold min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
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

      {/* Filter sheet */}
      {showFilterSheet && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowFilterSheet(false)} />
          <div
            className="fixed left-0 right-0 bottom-0 z-40 bg-[#1C1C1E] rounded-t-2xl shadow-2xl border-t border-white/8 overflow-y-auto"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)', maxHeight: '75vh' }}
          >
            <div className="sticky top-0 bg-[#1C1C1E] flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/6 z-10">
              <span className="text-sm font-semibold text-[#F5F5F7]">Filter</span>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-[#BF5AF2] font-medium">
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setShowFilterSheet(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white/8"
                >
                  <X className="w-3.5 h-3.5 text-[#8E8E93]" />
                </button>
              </div>
            </div>

            {/* Status */}
            <div className="px-4 pt-4 pb-4">
              <p className="text-[11px] font-semibold text-[#48484A] uppercase tracking-wide mb-2.5">Status</p>
              <div className="flex flex-wrap gap-2">
                {(mediaMode === 'tv' ? TV_STATUS_FILTERS : MOVIE_STATUS_FILTERS).map(f => {
                  const isActive = mediaMode === 'tv' ? filter === f.value : movieFilter === f.value
                  return (
                    <button
                      key={f.value}
                      onClick={() => mediaMode === 'tv' ? setFilter(f.value as SeriesStatus | 'all') : setMovieFilter(f.value as MovieStatus | 'all')}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        isActive ? 'bg-[#BF5AF2] text-white' : 'bg-[#2C2C2E] text-[#8E8E93] active:bg-[#383838]'
                      }`}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Rating */}
            <div className="px-4 pt-2 pb-4 border-t border-white/6">
              <p className="text-[11px] font-semibold text-[#48484A] uppercase tracking-wide mb-2.5">Min rating</p>
              <div className="flex flex-wrap gap-2">
                {RATING_OPTIONS.map(r => (
                  <button
                    key={String(r)}
                    onClick={() => setMinRating(r)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      minRating === r ? 'bg-[#BF5AF2] text-white' : 'bg-[#2C2C2E] text-[#8E8E93] active:bg-[#383838]'
                    }`}
                  >
                    {r == null ? 'Any' : `${r}+`}
                  </button>
                ))}
              </div>
            </div>

            {/* Platforms */}
            <div className="px-4 pt-2 pb-4 border-t border-white/6">
              <p className="text-[11px] font-semibold text-[#48484A] uppercase tracking-wide mb-2.5">Platforms</p>
              {loadingProviders ? (
                <div className="flex items-center gap-2 py-1">
                  <Loader2 className="w-3.5 h-3.5 text-[#48484A] animate-spin" />
                  <span className="text-xs text-[#48484A]">Loading...</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableProviders.map(p => {
                    const selected = filterPlatforms.includes(p.provider_id)
                    return (
                      <button
                        key={p.provider_id}
                        onClick={() => {
                          setFilterPlatforms(prev => {
                            const next = selected ? prev.filter(id => id !== p.provider_id) : [...prev, p.provider_id]
                            localStorage.setItem('tvfreak-default-providers', JSON.stringify(next))
                            return next
                          })
                        }}
                        className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition-all ${
                          selected ? 'border-[#BF5AF2]' : 'border-transparent opacity-40'
                        }`}
                      >
                        <img src={`${IMG_BASE}/original${p.logo_path}`} alt={p.provider_name} className="w-full h-full object-cover" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
