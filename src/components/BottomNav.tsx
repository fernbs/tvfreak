import { Home, Library, Search } from 'lucide-react'

export type Tab = 'home' | 'library' | 'search'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const tabs = [
  { id: 'home' as Tab, icon: Home, label: 'Home' },
  { id: 'library' as Tab, icon: Library, label: 'Library' },
  { id: 'search' as Tab, icon: Search, label: 'Search' },
]

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav
      className="shrink-0 flex bg-[#0D0D0D] border-t border-white/8"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
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
