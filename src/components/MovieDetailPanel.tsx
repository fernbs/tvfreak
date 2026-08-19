import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { X, Loader2, Plus, Play } from 'lucide-react'
import { getMovieDetails, getMovieRecommendations, getMovieWatchProviders, getMovieExternalIds, getRatings, getTrailerKey, posterUrl, IMG_BASE } from '../lib/tmdb'
import { getCountry } from '../lib/settings'
import { addMovie, updateMovie, deleteMovie } from '../lib/api'
import type { Movie, MovieStatus, TmdbMovieDetail, TmdbSearchResult, WatchProvider } from '../types'
import { MOVIE_STATUS_CONFIG } from '../types'
import { toast } from 'sonner'

interface Props {
  movie: Movie | null
  onClose: () => void
  onUpdated: () => void
  onSelect: (m: Movie) => void
}

function recToMovie(r: TmdbSearchResult): Movie {
  return {
    tmdbId: r.id,
    title: r.name,
    status: 'plantowatch',
    posterPath: r.poster_path ?? null,
    overview: r.overview ?? null,
    releaseDate: r.first_air_date ?? null,
    runtime: null,
    notes: '',
    imdbRating: (r.vote_average ?? 0) > 0 ? r.vote_average!.toFixed(1) : null,
    addedAt: new Date(),
    updatedAt: new Date(),
  }
}

function formatRuntime(mins: number | null): string {
  if (!mins) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`
}

export function MovieDetailPanel({ movie, onClose, onUpdated, onSelect }: Props) {
  const [minimized, setMinimized] = useState(false)
  const dragControls = useDragControls()
  const [detail, setDetail] = useState<TmdbMovieDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [recommendations, setRecommendations] = useState<TmdbSearchResult[]>([])
  const [providers, setProviders] = useState<{ flatrate: WatchProvider[]; free: WatchProvider[] }>({ flatrate: [], free: [] })
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const [imdbId, setImdbId] = useState<string | null>(null)
  const [rtRating, setRtRating] = useState<string | null>(null)
  const [mcRating, setMcRating] = useState<string | null>(null)
  const [ratingsLoaded, setRatingsLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [displayRating, setDisplayRating] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const isOpen = movie !== null
  const isInLibrary = Boolean(movie?.id)

  useEffect(() => {
    setMinimized(false)
    if (!movie?.tmdbId) { setDetail(null); setRecommendations([]); setTrailerKey(null); setImdbId(null); setRtRating(null); setMcRating(null); setRatingsLoaded(false); return }
    setLoadingDetail(true)
    setDetail(null)
    setRecommendations([])
    setTrailerKey(null)
    setImdbId(null)
    setRtRating(null)
    setMcRating(null)
    setDisplayRating(movie.imdbRating ?? null)
    getTrailerKey(movie.tmdbId, 'movie').then(setTrailerKey)

    Promise.all([
      getMovieDetails(movie.tmdbId),
      getMovieRecommendations(movie.tmdbId),
      getMovieWatchProviders(movie.tmdbId, getCountry()),
    ]).then(([d, recs, prov]) => {
      setDetail(d)
      setRecommendations(recs.slice(0, 12))
      setProviders({ flatrate: prov.flatrate, free: prov.free })
      if (d && (d.vote_average ?? 0) > 0 && !movie.imdbRating) {
        setDisplayRating(d.vote_average!.toFixed(1))
      }
      if (movie.tmdbId) {
        getMovieExternalIds(movie.tmdbId).then(ext => {
          if (ext.imdb_id) {
            setImdbId(ext.imdb_id)
            getRatings(ext.imdb_id).then(({ imdb, rt, mc }) => {
              if (imdb) setDisplayRating(imdb)
              if (rt) setRtRating(rt)
              if (mc) setMcRating(mc)
              setRatingsLoaded(true)
              if (movie.id) {
                const ratingUpdates: Partial<Movie> = {}
                if (imdb && imdb !== movie.imdbRating) ratingUpdates.imdbRating = imdb
                if (rt) ratingUpdates.rtRating = rt
                if (Object.keys(ratingUpdates).length > 0) {
                  updateMovie(movie.id, ratingUpdates).then(() => onUpdated())
                }
              }
            })
          } else {
            setRatingsLoaded(true)
          }
        })
      } else {
        setRatingsLoaded(true)
      }
    }).finally(() => setLoadingDetail(false))
  }, [movie?.tmdbId])

  useEffect(() => {
    if (isOpen) bodyRef.current?.scrollTo(0, 0)
  }, [isOpen, movie?.id])

  async function handleStatusChange(status: MovieStatus) {
    if (!movie?.id) return
    setSaving(true)
    try {
      await updateMovie(movie.id, { status })
      toast.success(`Moved to ${MOVIE_STATUS_CONFIG[status].label}`)
      onUpdated()
    } finally { setSaving(false) }
  }

  async function handleAdd() {
    if (!movie) return
    setAdding(true)
    try {
      const releaseDate = detail?.release_date ?? movie.releaseDate
      const id = await addMovie({
        tmdbId: movie.tmdbId,
        title: movie.title,
        status: 'plantowatch',
        posterPath: detail?.poster_path ?? movie.posterPath,
        overview: detail?.overview ?? movie.overview,
        releaseDate,
        runtime: detail?.runtime ?? null,
        notes: '',
        imdbRating: displayRating,
        addedAt: new Date(),
        updatedAt: new Date(),
      })
      toast.success(`"${movie.title}" added to watchlist`)
      onUpdated()
      onSelect({ ...movie, id, status: 'plantowatch', imdbRating: displayRating })
    } finally { setAdding(false) }
  }

  async function handleDelete() {
    if (!movie?.id) return
    if (!confirm(`Remove "${movie.title}" from your library?`)) return
    setDeleting(true)
    try {
      await deleteMovie(movie.id)
      toast.success(`"${movie.title}" removed`)
      onUpdated()
      onClose()
    } finally { setDeleting(false) }
  }

  const poster = posterUrl(detail?.poster_path ?? movie?.posterPath ?? null, 'w500')
  const releaseYear = (detail?.release_date ?? movie?.releaseDate ?? '').slice(0, 4)
  const runtime = formatRuntime(detail?.runtime ?? movie?.runtime ?? null)
  const currentStatus = movie?.status ?? 'plantowatch'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="movie-backdrop"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: minimized ? 0 : 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="movie-panel"
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (minimized) {
                if (info.velocity.y < -300 || info.offset.y < -40) setMinimized(false)
                else if (info.velocity.y > 400 || info.offset.y > 80) onClose()
              } else {
                if (info.velocity.y > 600 || info.offset.y > 200) onClose()
                else if (info.velocity.y > 200 || info.offset.y > 60) setMinimized(true)
              }
            }}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-[#111111] rounded-t-3xl overflow-hidden"
            style={{ maxHeight: '94dvh' }}
            initial={{ y: '100%' }}
            animate={{ y: minimized ? 'calc(100% - 80px)' : 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            {/* Drag handle */}
            <div
              className="flex justify-center pt-3 pb-5 shrink-0 touch-none"
              onPointerDown={(e) => dragControls.start(e)}
              onClick={() => { if (minimized) setMinimized(false) }}
            >
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/8 active:bg-white/15"
            >
              <X className="w-4 h-4 text-[#8E8E93]" />
            </button>

            {/* Scrollable body */}
            <div
              ref={bodyRef}
              className="flex-1 overflow-y-auto overscroll-contain"
            >

              {/* Hero — poster + title */}
              <div className="px-4 pt-2 pb-4">
                <div className="flex gap-4">
                  {/* Poster */}
                  <div className="w-[100px] h-[150px] rounded-2xl overflow-hidden bg-[#1C1C1E] shrink-0">
                    {poster && <img src={poster} alt={movie?.title} className="w-full h-full object-cover" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 pt-1">
                    <h2 className="text-xl font-bold text-[#F5F5F7] leading-tight">{movie?.title}</h2>
                    <div className="mt-1.5">
                    {(releaseYear || runtime) && (
                      <div className="flex items-center gap-2">
                        {releaseYear && <span className="text-sm text-[#8E8E93]">{releaseYear}</span>}
                        {runtime && <span className="text-sm text-[#8E8E93]">{runtime}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {!loadingDetail && (
                        <a
                          href={imdbId ? `https://www.imdb.com/title/${imdbId}/` : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => { if (!imdbId) e.preventDefault() }}
                          className="inline-flex items-center gap-1 px-2 py-[3px] bg-white/6 border border-white/10 rounded-full text-xs active:opacity-70 transition-opacity"
                        >
                          <span className="bg-[#F5C518] text-black font-black px-[3px] py-[2px] rounded-[2px] leading-none" style={{ fontSize: '7px' }}>IMDb</span>
                          <span className="font-medium leading-none" style={{ color: displayRating ? 'white' : '#8E8E93' }}>{displayRating ?? 'N/A'}</span>
                        </a>
                      )}
                      {ratingsLoaded && rtRating && (
                        <a
                          href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(movie?.title ?? '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-[3px] bg-white/6 border border-white/10 rounded-full text-xs active:opacity-70 transition-opacity"
                        >
                          {parseInt(rtRating) >= 60 ? (
                            <span className="leading-none" style={{ fontSize: '12px' }}>🍅</span>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
                              <path d="M6,0.5 L7.4,4.2 L11.5,4.2 L8.3,6.6 L9.5,10.5 L6,8.2 L2.5,10.5 L3.7,6.6 L0.5,4.2 L4.6,4.2 Z" fill="#22C55E"/>
                            </svg>
                          )}
                          <span className="font-medium leading-none text-white">{rtRating}</span>
                        </a>
                      )}
                      {mcRating && (
                        <span className="inline-flex items-center gap-1 px-2 py-[3px] bg-white/6 border border-white/10 rounded-full text-xs">
                          <span className="bg-[#66CC33] text-black font-black px-[3px] py-[2px] rounded-[2px] leading-none" style={{ fontSize: '7px' }}>MC</span>
                          <span className="text-white font-medium leading-none">{mcRating}</span>
                        </span>
                      )}
                    </div>
                  </div>
                    {detail?.genres && detail.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {detail.genres.slice(0, 3).map(g => (
                          <span key={g.id} className="text-[10px] text-[#48484A] bg-white/5 px-1.5 py-0.5 rounded-md">{g.name}</span>
                        ))}
                      </div>
                    )}
                    {loadingDetail && <Loader2 className="w-4 h-4 text-[#48484A] animate-spin mt-2" />}
                  </div>
                </div>

                {/* Status selector */}
                {isInLibrary && (
                  <div className="flex gap-2 mt-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {(Object.entries(MOVIE_STATUS_CONFIG) as [MovieStatus, { label: string; color: string }][]).map(([s, cfg]) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        disabled={saving}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          currentStatus === s
                            ? ''
                            : 'bg-transparent border-white/10 text-[#48484A]'
                        }`}
                        style={currentStatus === s ? {
                          backgroundColor: cfg.color + '20',
                          borderColor: cfg.color + '50',
                          color: cfg.color,
                        } : {}}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Add to watchlist button (not in library yet) */}
                {!isInLibrary && (
                  <button
                    onClick={handleAdd}
                    disabled={adding}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold active:opacity-80 transition-opacity disabled:opacity-50"
                  >
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add to Watchlist
                  </button>
                )}
              </div>

              {/* Director / writer / overview */}
              {(detail?.overview || movie?.overview || detail?.credits) && (
                <div className="px-4 mb-4">
                  {(() => {
                    const director = detail?.credits?.crew?.find(c => c.job === 'Director')?.name
                    const writers = detail?.credits?.crew?.filter(c => c.department === 'Writing').slice(0, 2).map(c => c.name).join(', ')
                    return (
                      <>
                        {director && (
                          <p className="text-[11px] text-[#8E8E93] mb-1">
                            <span className="text-[#48484A]">Directed by</span> {director}
                          </p>
                        )}
                        {writers && (
                          <p className="text-[11px] text-[#8E8E93] mb-2">
                            <span className="text-[#48484A]">Written by</span> {writers}
                          </p>
                        )}
                      </>
                    )
                  })()}
                  {(detail?.overview || movie?.overview) && (
                    <p className="text-sm text-[#8E8E93] leading-relaxed">{detail?.overview ?? movie?.overview}</p>
                  )}
                </div>
              )}

              {/* Cast */}
              {detail?.credits?.cast && detail.credits.cast.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] text-[#48484A] mb-2.5 uppercase tracking-widest font-semibold px-4">Cast</p>
                  <div className="flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
                    {detail.credits.cast.slice(0, 12).map(actor => (
                      <a
                        key={actor.id}
                        href={`https://www.themoviedb.org/person/${actor.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 w-14 text-center block active:opacity-70 transition-opacity"
                      >
                        <div className="w-14 h-14 rounded-full overflow-hidden bg-[#1C1C1E] mb-1 mx-auto">
                          {actor.profile_path ? (
                            <img src={`${IMG_BASE}/w185${actor.profile_path}`} alt={actor.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#2C2C2E]">
                              <span className="text-[18px] font-bold text-[#48484A]">{actor.name[0]}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-[#F5F5F7] leading-tight font-medium line-clamp-2">{actor.name}</p>
                        <p className="text-[8px] text-[#48484A] leading-tight line-clamp-2">{actor.character}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Trailer */}
              {trailerKey && (
                <div className="px-4 mb-4">
                  <a
                    href={`https://www.youtube.com/watch?v=${trailerKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/6 border border-white/10 text-sm font-semibold text-[#F5F5F7] active:opacity-70 transition-opacity"
                  >
                    <Play className="w-4 h-4 text-[var(--color-accent)]" />
                    Watch Trailer
                  </a>
                </div>
              )}

              {/* Watch providers */}
              {(providers.flatrate.length > 0 || providers.free.length > 0) && (
                <div className="px-4 mb-5">
                  <p className="text-[10px] text-[#48484A] mb-2.5 uppercase tracking-widest font-semibold">Where to watch</p>
                  <div className="flex gap-2 flex-wrap">
                    {[...providers.flatrate, ...providers.free].slice(0, 8).map(p => (
                      <div key={p.provider_id} className="w-9 h-9 rounded-xl overflow-hidden bg-[#1C1C1E]">
                        <img src={`${IMG_BASE}/w92${p.logo_path}`} alt={p.provider_name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] text-[#48484A] mb-2.5 uppercase tracking-widest font-semibold px-4">More like this</p>
                  <div className="flex gap-2.5 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: 'none' }}>
                    {recommendations.map(r => (
                      <button
                        key={r.id}
                        onClick={() => onSelect(recToMovie(r))}
                        className="shrink-0 w-[72px] text-left active:opacity-70 transition-opacity"
                      >
                        <div className="w-[72px] h-[108px] rounded-xl overflow-hidden bg-[#1C1C1E] mb-1.5 relative">
                          {r.poster_path ? (
                            <img src={posterUrl(r.poster_path, 'w185') ?? ''} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center p-1">
                              <span className="text-[8px] text-[#48484A] text-center">{r.name}</span>
                            </div>
                          )}
                          {(r.vote_average ?? 0) > 0 && (
                            <div className="absolute top-1 left-1 px-1 rounded bg-black/65 flex items-center gap-px">
                              <span className="text-[var(--color-accent)] leading-none" style={{ fontSize: '9px' }}>★</span>
                              <span className="text-white font-semibold leading-none" style={{ fontSize: '9px' }}>{r.vote_average!.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[9px] text-[#8E8E93] leading-tight line-clamp-2">{r.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Delete button */}
              {isInLibrary && (
                <div className="px-4 pb-10">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="w-full py-2.5 rounded-xl border border-rose-500/20 text-rose-400 text-sm font-medium active:opacity-70 transition-opacity disabled:opacity-50"
                  >
                    {deleting ? 'Removing...' : 'Remove from library'}
                  </button>
                </div>
              )}

              {!isInLibrary && <div className="pb-10" />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
