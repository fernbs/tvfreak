import { useEffect } from 'react'
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

// Runs once at module-load time, before React mounts.
// Sets --tvf-sab on <html> so both the nav and the main content
// can reference the same value without prop drilling or re-renders.
const INITIAL_SAB: number = (() => {
  const detect = (): number => {
    const stored = localStorage.getItem(SAB_KEY)
    if (stored) {
      const v = parseInt(stored, 10)
      if (v > 0) return v
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

    if ((navigator as Navigator & { standalone?: boolean }).standalone === true) {
      if (Math.max(screen.width, screen.height) >= 812) return 34
    }

    return 0
  }

  const result = detect()
  document.documentElement.style.setProperty('--tvf-sab', `${result}px`)
  return result
})()

export { INITIAL_SAB }

export function BottomNav({ active, onChange }: Props) {
  useEffect(() => {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none'
    document.body.appendChild(probe)

    const capture = () => {
      const v = parseInt(getComputedStyle(probe).paddingBottom, 10) || 0
      if (v > 0) {
        document.documentElement.style.setProperty('--tvf-sab', `${v}px`)
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
      className="fixed left-0 right-0 flex bg-[#060C16]/95 backdrop-blur-md border-t border-white/8 z-10"
      style={{ bottom: 0, paddingBottom: 'var(--tvf-sab, 0px)' }}
    >
      {tabs.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
            active === id ? 'text-[#3B82F6]' : 'text-white/30 active:text-white/60'
          }`}
        >
          {active === id && (
            <span
              className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
              style={{ backgroundColor: '#3B82F6', boxShadow: '0 0 10px 3px rgba(59,130,246,0.55)' }}
            />
          )}
          <Icon className="w-5 h-5" strokeWidth={active === id ? 2.5 : 1.8} />
          <span className="text-[10px] font-medium tracking-wide">{label}</span>
        </button>
      ))}
    </nav>
  )
}
