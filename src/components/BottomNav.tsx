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

function readSab(): number {
  // Stored value from a previous orientation-change capture (most accurate)
  const stored = localStorage.getItem(SAB_KEY)
  if (stored) return Math.max(0, parseInt(stored, 10) || 0)
  // iOS PWA cold-open: env() returns 0, so probe is useless at this point.
  // All home-indicator iPhones (X and newer) have screen height >= 812px.
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) {
    if (Math.max(screen.width, screen.height) >= 812) return 34
  }
  return 0
}

export function BottomNav({ active, onChange }: Props) {
  // useState initializer runs synchronously during the first render (before paint),
  // unlike useEffect which runs after. No gap on first frame.
  const [sab, setSab] = useState<number>(readSab)

  useEffect(() => {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none'
    document.body.appendChild(probe)

    const capture = () => {
      const val = Math.max(0, parseInt(getComputedStyle(probe).paddingBottom, 10) || 0)
      if (val > 0) {
        setSab(val)
        localStorage.setItem(SAB_KEY, String(val))
      }
    }

    const onOrientationChange = () => setTimeout(capture, 150)
    window.addEventListener('orientationchange', onOrientationChange)

    const vv = window.visualViewport
    if (vv) vv.addEventListener('resize', capture)

    return () => {
      window.removeEventListener('orientationchange', onOrientationChange)
      if (vv) vv.removeEventListener('resize', capture)
      probe.parentNode?.removeChild(probe)
    }
  }, [])

  return (
    <nav
      className="fixed left-0 right-0 flex bg-[#0D0D0D] border-t border-white/8 z-10"
      style={{ bottom: `-${sab}px`, paddingBottom: `${sab}px` }}
    >
      {tabs.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
            active === id ? 'text-[#6366F1]' : 'text-white/30 active:text-white/60'
          }`}
        >
          <Icon className="w-5 h-5" strokeWidth={active === id ? 2.5 : 1.8} />
          <span className="text-[10px] font-medium tracking-wide">{label}</span>
        </button>
      ))}
    </nav>
  )
}
