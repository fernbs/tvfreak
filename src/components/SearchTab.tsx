import { useState, useEffect, useRef } from 'react'
import { Search, X, Plus, Loader2 } from 'lucide-react'
import { searchTv, posterUrl } from '../lib/tmdb'
import { addSeries } from '../lib/api'
import type { TmdbSearchResult, Series } from '../types'
import { toast } from 'sonner'

interface Props {
  onSeriesAdded: () => void
  allSeries: Series[]
}

export function SearchTab({ onSeriesAdded, allSeries }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await searchTv(query)
        setResults(r.slice(0, 20))
      } finally {
        setSearching(false)
      }
    }, 400)
  }, [query])

  const libraryIds = new Set(allSeries.map(s => s.tmdbId).filter(Boolean))

  async function handleAdd(result: TmdbSearchResult) {
    if (libraryIds.has(result.id)) {
      toast.error('Already in your library')
      return
    }
    setAddingId(result.id)
    try {
      await addSeries({
        tmdbId: result.id,
        title: result.name,
        status: 'plantowatch',
        posterPath: result.poster_path,
        overview: result.overview,
        firstAirDate: result.first_air_date,
        lastAirDate: null,
        numberOfSeasons: result.number_of_seasons ?? null,
        notes: '',
        addedAt: new Date(),
        updatedAt: new Date(),
      })
      toast.success(`"${result.name}" added to library`)
      onSeriesAdded()
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky search header */}
      <div
        className="shrink-0 bg-[#0A0A0A] px-4 pb-3 z-10"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)' }}
      >
        <h1 className="text-lg font-bold text-white mb-3">Search</h1>
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl bg-[#1E1E1E] border border-white/8 focus-within:border-white/20 transition-colors">
          {searching ? (
            <Loader2 className="w-4 h-4 text-white/40 shrink-0 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-white/40 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search TMDB for a series..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="shrink-0">
              <X className="w-4 h-4 text-white/40" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        {!query.trim() ? (
          <div className="flex flex-col items-center justify-center h-full pb-12 text-center px-6">
            <Search className="w-12 h-12 text-white/8 mb-4" />
            <p className="text-sm text-white/25">Search any TV series to add it to your library</p>
          </div>
        ) : results.length === 0 && !searching ? (
          <div className="flex flex-col items-center justify-center h-full pb-12 text-center px-6">
            <p className="text-sm text-white/25">No results for "{query}"</p>
          </div>
        ) : (
          <div className="pb-6">
            {results.map(r => {
              const inLibrary = libraryIds.has(r.id)
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/4 active:bg-white/3 transition-colors">
                  <div className="w-10 h-[60px] rounded-lg shrink-0 overflow-hidden bg-[#2A2A2A]">
                    {r.poster_path && (
                      <img
                        src={posterUrl(r.poster_path, 'w185') ?? ''}
                        alt={r.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-snug truncate">{r.name}</p>
                    <p className="text-xs text-white/35 mt-0.5">
                      {r.first_air_date ? r.first_air_date.slice(0, 4) : 'Unknown year'}
                    </p>
                  </div>
                  {inLibrary ? (
                    <span className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium text-white/30 bg-white/5">
                      In library
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAdd(r)}
                      disabled={addingId === r.id}
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-[#6366F1]/15 text-[#6366F1] active:bg-[#6366F1]/30 transition-colors disabled:opacity-50"
                    >
                      {addingId === r.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
