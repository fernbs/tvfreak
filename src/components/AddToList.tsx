// Botón "Add to list" de la ficha de película. Las listas son las mismas que ve la tele
// (tablas tv_lists y tv_list_items), y añadir a una lista no toca el estado de la película.
import { useState } from 'react'
import { ListPlus, Check, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { getLists, createList, addToList, removeFromList } from '../lib/api'
import { getMovieExternalIds } from '../lib/tmdb'
import type { MovieList } from '../types'
import { LISTS_CHANGED } from './ListChips'

interface Props {
  tmdbId: number
  title: string
  releaseDate: string | null
  posterPath: string | null
  overview: string | null
  imdbId: string | null
}

export function AddToList({ tmdbId, title, releaseDate, posterPath, overview, imdbId }: Props) {
  const [open, setOpen] = useState(false)
  const [lists, setLists] = useState<MovieList[] | null>(null)
  const [busy, setBusy] = useState<number | 'new' | null>(null)
  const [newName, setNewName] = useState('')

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) setLists(await getLists(tmdbId))
  }

  async function add(list: MovieList) {
    // Sin imdbId la tele no puede enseñar la película en su fila
    const imdb = imdbId ?? (await getMovieExternalIds(tmdbId)).imdb_id
    const year = releaseDate ? parseInt(releaseDate.slice(0, 4)) || null : null
    await addToList(list.id, { tmdbId, imdbId: imdb, title, year, posterPath, overview })
    if (imdb) toast.success(`Added to "${list.name}"`)
    else toast.warning(`Added to "${list.name}", but it won't show on the TV (no IMDb id)`)
  }

  async function toggle(list: MovieList) {
    setBusy(list.id)
    try {
      if (list.has) {
        await removeFromList(list.id, tmdbId)
        toast.success(`Removed from "${list.name}"`)
      } else {
        await add(list)
      }
      setLists(await getLists(tmdbId))
      window.dispatchEvent(new Event(LISTS_CHANGED))
    } catch {
      toast.error('Could not update the list')
    } finally { setBusy(null) }
  }

  async function create() {
    const name = newName.trim()
    if (!name) return
    setBusy('new')
    try {
      const list = await createList(name)
      await add(list)
      setNewName('')
      setLists(await getLists(tmdbId))
      window.dispatchEvent(new Event(LISTS_CHANGED))
    } catch {
      toast.error('Could not create the list')
    } finally { setBusy(null) }
  }

  const inCount = lists?.filter(l => l.has).length ?? 0

  return (
    <div className="mt-3">
      <button
        onClick={toggleOpen}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/6 border border-white/10 text-sm font-semibold text-[#F5F5F7] active:opacity-70 transition-opacity"
      >
        <ListPlus className="w-4 h-4 text-[var(--color-accent)]" />
        {inCount > 0 ? `In ${inCount} list${inCount > 1 ? 's' : ''}` : 'Add to list'}
      </button>

      {open && (
        <div className="mt-2 rounded-xl bg-white/4 border border-white/8 p-2">
          {lists === null && <Loader2 className="w-4 h-4 text-[#48484A] animate-spin m-2" />}
          {lists?.map(l => (
            <button
              key={l.id}
              onClick={() => toggle(l)}
              disabled={busy !== null}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left active:bg-white/8 disabled:opacity-50"
            >
              <span className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center ${l.has ? 'bg-[var(--color-accent)] border-transparent' : 'border-white/20'}`}>
                {busy === l.id ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : l.has ? <Check className="w-3 h-3 text-white" /> : null}
              </span>
              <span className="flex-1 text-sm text-[#F5F5F7] truncate">{l.name}</span>
              <span className="text-xs text-[#48484A]">{l.itemCount}</span>
            </button>
          ))}
          <div className="flex gap-2 mt-1 px-1">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create() }}
              placeholder="New list"
              className="flex-1 min-w-0 bg-white/6 rounded-lg px-3 py-2 text-sm text-[#F5F5F7] placeholder:text-[#48484A] outline-none"
            />
            <button
              onClick={create}
              disabled={busy !== null || !newName.trim()}
              className="px-3 rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-40"
              aria-label="Create list"
            >
              {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
