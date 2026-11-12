// Fila de chips con las listas de películas (las mismas que ve la tele).
// Al elegir una, la Biblioteca enseña sus películas. Con una elegida se puede renombrar o borrar.
import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getLists, getListItems, renameList, deleteList } from '../lib/api'
import type { MovieList, MovieListItem } from '../types'

// AddToList lanza este evento cuando cambia una lista, para refrescar los chips
export const LISTS_CHANGED = 'tvfreak:lists-changed'

interface Props {
  selected: number | null
  onSelect: (id: number | null, items: MovieListItem[]) => void
}

export function ListChips({ selected, onSelect }: Props) {
  const [lists, setLists] = useState<MovieList[]>([])
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  // Relee las listas y, si hay una elegida, sus películas
  async function reload() {
    const all = await getLists()
    setLists(all)
    const sel = selectedRef.current
    if (sel == null) return
    if (all.some(l => l.id === sel)) onSelect(sel, await getListItems(sel).catch(() => []))
    else onSelect(null, [])
  }

  useEffect(() => {
    getLists().then(setLists)
    window.addEventListener(LISTS_CHANGED, reload)
    return () => window.removeEventListener(LISTS_CHANGED, reload)
  }, [])

  async function pick(id: number) {
    if (id === selected) { onSelect(null, []); return }
    try { onSelect(id, await getListItems(id)) }
    catch { toast.error('Could not load the list') }
  }

  async function rename(l: MovieList) {
    const name = prompt('Rename list', l.name)?.trim()
    if (!name || name === l.name) return
    try { await renameList(l.id, name); reload() }
    catch { toast.error('Could not rename the list') }
  }

  async function remove(l: MovieList) {
    if (!confirm(`Delete the list "${l.name}"? The films stay in your library.`)) return
    try {
      await deleteList(l.id)
      toast.success(`"${l.name}" deleted`)
      onSelect(null, [])
      window.dispatchEvent(new Event(LISTS_CHANGED)) // el Inicio también se refresca
    } catch { toast.error('Could not delete the list') }
  }

  if (lists.length === 0) return null

  return (
    <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {lists.map(l => {
        const active = l.id === selected
        return (
          <div key={l.id} className="shrink-0 flex items-center gap-1">
            <button
              onClick={() => pick(l.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active
                  ? 'bg-[rgba(var(--accent-rgb),0.15)] border-[rgba(var(--accent-rgb),0.4)] text-[var(--color-accent)]'
                  : 'bg-transparent border-white/10 text-[#8E8E93]'
              }`}
            >
              {l.name} <span className="opacity-60">{l.itemCount}</span>
            </button>
            {active && (
              <>
                <button onClick={() => rename(l)} aria-label="Rename list" className="p-1.5 rounded-full text-[#8E8E93] active:bg-white/8">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(l)} aria-label="Delete list" className="p-1.5 rounded-full text-rose-400 active:bg-white/8">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
