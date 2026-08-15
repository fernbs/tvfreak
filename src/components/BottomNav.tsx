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

// Runs once at module-load time, before React mounts.
// This is the only timing that's guaranteed to precede the very first paint.
const INITIAL_SAB: number = (() => {
  // 1. Stored value from a previous successful capture — most accurate.
  //    Skip if it parses to 0 or less; fall through to live detection.
  const stored = localStorage.getItem(SAB_KEY)
  if (stored) {
    const v = parseInt(stored, 10)
    if (v > 0) return v
  }

  // 2. Try reading env() via a transient probe element.
  //    Works immediately in Safari (env() always resolves there).
  //    In iOS PWA cold-open, env() returns 0 — handled by step 3.
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
  } catch (_) { /* document not ready or env() unavailable */ }

  // 3. iOS PWA cold-open: env() returns 0 before the first orientation change.
  //    All home-indicator iPhones (X and newer) have a logical height >= 812 px.
  //    Older iPhones with a home button are <= 736 px and need no safe area.
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) {
    if (Math.max(screen.width, screen.height) >= 812) return 34
  }

  return 0
})()

export function BottomNav({ active, onChange }: Props) {
  const [sab, setSab] = useState(INITIAL_SAB)

  useEffect(() => {
    // Keep a live probe to capture the real env() value whenever it resolves,
    // and persist it so all future loads get the accurate reading.
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

    // Short-interval retries in case env() resolves with a brief delay on some iOS builds.
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
      className="fixed left-0 right-0 flex bg-[#0D0D0D] border-t border-white/8 z-10"
      style={{ bottom: `-${sab}px`, paddingBottom: `${sab}px` }}
    >
      {tabs.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
            active === id ? 'text-[#06B6D4]' : 'text-white/30 active:text-white/60'
          }`}
        >
          <Icon className="w-5 h-5" strokeWidth={active === id ? 2.5 : 1.8} />
          <span className="text-[10px] font-medium tracking-wide">{label}</span>
        </button>
      ))}
    </nav>
  )
}
