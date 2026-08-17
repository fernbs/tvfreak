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

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex bg-black/94 backdrop-blur-2xl border-t border-white/6 z-10 nav-safe-pad"
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
                backgroundColor: '#BF5AF2',
                opacity: isActive ? 1 : 0,
              }}
            />
            <Icon
              className={`w-[22px] h-[22px] transition-all duration-200 ${isActive ? 'text-[#BF5AF2]' : 'text-[#48484A]'}`}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
            <span className={`text-[10px] font-medium tracking-wide transition-colors duration-200 ${
              isActive ? 'text-[#BF5AF2]' : 'text-[#48484A]'
            }`}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
