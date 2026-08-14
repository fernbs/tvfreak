import { useState } from 'react'

export type ViewMode = 'big' | 'small' | 'list'

const STORAGE_KEY = 'tvfreak-view-mode'

export function useViewMode() {
  const [mode, setMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'big' || saved === 'small' || saved === 'list' ? saved : 'small'
  })

  function persist(m: ViewMode) {
    setMode(m)
    localStorage.setItem(STORAGE_KEY, m)
  }

  return [mode, persist] as const
}
