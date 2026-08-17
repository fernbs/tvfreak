import { useState } from 'react'

export type ViewMode = 'big' | 'small' | 'list'

export function useViewMode(storageKey: string) {
  const [mode, setMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(storageKey)
    return saved === 'big' || saved === 'small' || saved === 'list' ? saved : 'small'
  })

  function persist(m: ViewMode) {
    setMode(m)
    localStorage.setItem(storageKey, m)
  }

  return [mode, persist] as const
}
