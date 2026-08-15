import { useState, useEffect } from 'react'
import { Home, Library, Search, BarChart2 } from 'lucide-react'

export type Tab = 'home' | 'library' | 'search' | 'stats'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const tabs = [
  { id: 'home' as Tab, icon: Home, label: 'Home' },
  { id: 'library' as Tab, icon: Library, label: 'Library' },
  { id: 'search' as Tab, icon: Search, label: 'Search' },
  { id: 'stats' as Tab, icon: BarChart2, label: 'Stats' },
]

const SAB_KEY = 'tvfreak-sab'

const INITIAL_SAB: number = (() => {
  const isStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true

  if (isStandalone) {
    const stored = localStorage.getItem(SAB_KEY)
    if (stored) {
      const v = parseInt(stored, 10)
      if (v > 0) return v
    }
  }

  try {
    const el = document.createElement('div')
    el.style.cssText =
      'position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden'
    document.documentElement.appendChild(el)
    const v = parseInt(getComputedStyle(el).paddingBottom, 10) || 0
    document.documentElement.removeChild(el)
    if (v > 0) {
      localStorage.setItem(SAB_KEY, String(v))
      return v
    }
  } catch (_) { /* env() unavailable */ }

  if (isStandalone && Math.max(screen.width, screen.height) >= 812) return 34

  return 0
})()

export function BottomNav({ active, onChange }: Props) {
  const [sab, setSab] = useState(INITIAL_SAB)

  useEffect(() => {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none'
    document.body.appendChild(probe)

    const capture = () => {
      const v = parseInt(getComputedStyle(probe).paddingBottom, 10) || 0
      if (v > 0) {
        setSab(v)
        localStorage.setItem(SAB_KEY, String(v))
      }
    }

    const timers = [100, 300, 800].map(d => setTimeout(capture, d))
    const onOrientationChange = () => setTimeout(capture, 150)
    window.addEventListener('orientationchange', onOrientationChange)
    const vv = window.visualViewport
    if (vv) vv.addEventListener('resize', capture)

    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('orientationchange', onOrientationChange)
      if (vv) vv.removeEventListener('resize', capture)
      probe.parentNode?.removeChild(probe)
    }
  }, [])

  return (
    <nav
      className="fixed left-0 right-0 flex bg-black/94 backdrop-blur-2xl border-t border-white/6 z-10"
      style={{ bottom: `-${sab}px`, paddingBottom: `${sab}px` }}
    >
      {tabs.map(({ id, icon: Icon, label }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="flex-1 flex flex-col items-center justify-center gap-[5px] py-3 relative transition-colors"
          >
            {/* Amber capsule indicator at top */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full transition-all duration-300"
              style={{
                width: isActive ? 28 : 0,
                backgroundColor: '#FF9F0A',
                opacity: isActive ? 1 : 0,
              }}
            />
            <Icon
              className={`w-[22px] h-[22px] transition-all duration-200 ${isActive ? 'text-white' : 'text-[#48484A]'}`}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
            <span className={`text-[10px] font-medium tracking-wide transition-colors duration-200 ${
              isActive ? 'text-white' : 'text-[#48484A]'
            }`}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
