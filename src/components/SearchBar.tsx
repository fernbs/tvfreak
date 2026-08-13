import { useState, useEffect, useRef } from 'react'
import { Search, X, Plus, Loader2 } from 'lucide-react'
import { searchTv, posterUrl } from '../lib/tmdb'
import { addSeries, getAllSeries } from '../lib/db'
import type { TmdbSearchResult, SeriesStatus } from '../types'
import { STATUS_CONFIG } from '../types'
import { toast } from 'sonner'

interface Props {
  onSeriesAdded: () => void
}

export function SearchBar({ onSeriesAdded }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [statusPicker, setStatusPicker] = useState<TmdbSearchResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const r = await searchTv(query)
      setResults(r.slice(0, 6))
      setOpen(true)
      setSearching(false)
    }, 400)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setStatusPicker(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleAdd(result: TmdbSearchResult, status: SeriesStatus) {
    setAddingId(result.id)
    try {
      const existing = await getAllSeries()
      if (existing.some(s => s.tmdbId === result.id)) {
        toast.error('Already in your library')
        setAddingId(null)
        setStatusPicker(null)
        return
      }
      await addSeries({
        tmdbId: result.id,
        title: result.name,
        status,
        posterPath: result.poster_path,
        overview: result.overview,
        firstAirDate: result.first_air_date,
        lastAirDate: null,
        numberOfSeasons: result.number_of_seasons ?? null,
        notes: '',
        addedAt: new Date(),
        updatedAt: new Date(),
      })
      toast.success(`Added "${result.name}"`)
      onSeriesAdded()
      setQuery('')
      setOpen(false)
      setStatusPicker(null)
    } finally {
      setAddingId(null)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1E1E1E] border border-white/8 focus-within:border-white/20 transition-colors">
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
          placeholder="Search to add a series..."
          className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false) }}>
            <X className="w-4 h-4 text-white/40 hover:text-white/70 transition-colors" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-[#1E1E1E] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
          {results.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors">
              <div className="w-9 h-14 rounded shrink-0 overflow-hidden bg-[#2A2A2A]">
                {r.poster_path && (
                  <img
                    src={posterUrl(r.poster_path, 'w185') ?? ''}
                    alt={r.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{r.name}</p>
                <p className="text-xs text-white/40">
                  {r.first_air_date ? r.first_air_date.slice(0, 4) : 'Unknown year'}
                </p>
              </div>

              {statusPicker?.id === r.id ? (
                <div className="flex gap-1 shrink-0">
                  {(Object.entries(STATUS_CONFIG) as [SeriesStatus, (typeof STATUS_CONFIG)[SeriesStatus]][]).map(([status, cfg]) => (
                    <button
                      key={status}
                      onClick={() => handleAdd(r, status)}
                      disabled={addingId === r.id}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${cfg.bgClass} ${cfg.textClass} hover:opacity-80`}
                      title={cfg.label}
                    >
                      {cfg.label.slice(0, 4)}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setStatusPicker(r)}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/8 hover:bg-white/15 transition-colors"
                >
                  <Plus className="w-4 h-4 text-white/70" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
