// Secciones del Inicio, una por lista de películas (las mismas que ve la tele).
// La papelera junto al nombre borra la lista, y sus películas vuelven a "Films".
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteList } from '../lib/api'
import { posterUrl } from '../lib/tmdb'
import type { Movie, MovieList, MovieListItem } from '../types'
import type { ViewMode } from '../lib/useViewMode'
import { LISTS_CHANGED } from './ListChips'

interface Props {
  lists: MovieList[]
  items: (MovieListItem & { listId: number })[]
  allMovies: Movie[]
  viewMode: ViewMode
  onMovieSelect: (m: Movie) => void
}

// Si la película está en la biblioteca se usa esa (con su estado), si no, una ficha sin guardar
function toMovie(it: MovieListItem, allMovies: Movie[]): Movie {
  return allMovies.find(m => m.tmdbId === it.tmdbId) ?? {
    tmdbId: it.tmdbId,
    title: it.title,
    status: 'plantowatch',
    posterPath: it.posterPath,
    overview: it.overview,
    releaseDate: it.year ? `${it.year}-01-01` : null,
    runtime: null,
    notes: '',
    imdbRating: null,
    rtRating: null,
    addedAt: new Date(),
    updatedAt: new Date(),
  }
}

export function HomeListSections({ lists, items, allMovies, viewMode, onMovieSelect }: Props) {
  async function remove(l: MovieList) {
    if (!confirm(`Delete the list "${l.name}"? The films stay in your library.`)) return
    try {
      await deleteList(l.id)
      toast.success(`"${l.name}" deleted`)
      window.dispatchEvent(new Event(LISTS_CHANGED))
    } catch { toast.error('Could not delete the list') }
  }

  return (
    <>
      {lists.map(l => {
        const movies = items.filter(it => it.listId === l.id).map(it => toMovie(it, allMovies))
        if (movies.length === 0) return null
        return (
          <div key={l.id} className="mt-5">
            <div className="flex items-center justify-between mb-2 mt-1">
              <p className="text-xs text-[#48484A] uppercase tracking-wider font-medium">{l.name}</p>
              <button onClick={() => remove(l)} aria-label={`Delete list ${l.name}`} className="p-1.5 -mr-1.5 rounded-full text-rose-400/70 active:bg-white/8">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {viewMode === 'list' ? (
              <div className="space-y-2">
                {movies.map(m => (
                  <button
                    key={m.tmdbId}
                    onClick={() => onMovieSelect(m)}
                    className="w-full flex items-center gap-3 p-3 bg-[#111111] rounded-xl border border-white/7 active:bg-[#1C1C1E] transition-colors text-left"
                  >
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-[#1C1C1E] shrink-0">
                      {m.posterPath && <img src={posterUrl(m.posterPath, 'w185') ?? ''} alt={m.title} className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#F5F5F7] truncate">{m.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-[#48484A]">Film</p>
                        {m.imdbRating && <span className="text-[10px] font-semibold text-white"><span className="text-[#F5C518]">IMDb</span> {m.imdbRating}</span>}
                        {m.rtRating && <span className="text-[10px] font-semibold text-white"><span className="text-[#FA320A]">RT</span> {m.rtRating}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className={`grid gap-2.5 ${viewMode === 'big' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {movies.map(m => (
                  <button
                    key={m.tmdbId}
                    onClick={() => onMovieSelect(m)}
                    className="relative text-left active:opacity-70 transition-opacity"
                  >
                    <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#1C1C1E] mb-1 relative">
                      {m.posterPath ? (
                        <img src={posterUrl(m.posterPath, 'w342') ?? ''} alt={m.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-2">
                          <span className="text-[10px] text-[#48484A] text-center">{m.title}</span>
                        </div>
                      )}
                      <div className="absolute right-1.5 bottom-1.5 flex flex-col items-end gap-0.5">
                        {m.rtRating && <div className="px-1 py-0.5 rounded text-[9px] font-semibold bg-black/75"><span className="text-[#FA320A]">RT</span><span className="text-white"> {m.rtRating}</span></div>}
                        {m.imdbRating && <div className="px-1 py-0.5 rounded text-[9px] font-semibold bg-black/75"><span className="text-[#F5C518]">IMDb</span><span className="text-white"> {m.imdbRating}</span></div>}
                      </div>
                    </div>
                    <p className={`text-[#8E8E93] leading-tight line-clamp-2 ${viewMode === 'big' ? 'text-[11px]' : 'text-[10px]'}`}>{m.title}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
