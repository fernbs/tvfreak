import { useState, useRef } from 'react'
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, Tv } from 'lucide-react'
import type { Series } from '../types'
import { SeriesGrid } from './SeriesGrid'
import { formatAirDate } from '../lib/utils'
import { posterUrl } from '../lib/tmdb'
import type { ViewMode } from '../lib/useViewMode'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Props {
  series: Series[]
  loading: boolean
  onSelect: (s: Series) => void
  viewMode: ViewMode
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  return d
}

export function HomeTab({ series, loading, onSelect, viewMode }: Props) {
  const [view, setView] = useState<'watching' | 'upcoming'>('watching')
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calOpen, setCalOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(20)
  const scrollRef = useRef<HTMLDivElement>(null)

  const today = new Date()
  const todayStr = toDateStr(today)

  const episodeMap = new Map<string, Series[]>()
  for (const s of series) {
    const dates = (s.futureDates && s.futureDates.length > 0)
      ? s.futureDates.filter(d => d > todayStr)
      : (s.nextEpisodeDate && s.nextEpisodeDate > todayStr ? [s.nextEpisodeDate] : [])
    for (const d of dates) {
      if (!episodeMap.has(d)) episodeMap.set(d, [])
      if (!episodeMap.get(d)!.find(x => x.id === s.id)) episodeMap.get(d)!.push(s)
    }
  }

  type UpcomingItem = { date: string; series: Series }
  const allUpcoming: UpcomingItem[] = []
  for (const [date, seriesList] of [...episodeMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const s of seriesList) allUpcoming.push({ date, series: s })
  }

  const calMonthPrefix = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}-`
  const listItems: UpcomingItem[] = selectedDate
    ? (episodeMap.get(selectedDate) ?? []).map(s => ({ date: selectedDate, series: s }))
    : allUpcoming.filter(({ date }) => date.startsWith(calMonthPrefix))

  const watchingNow = series
    .filter(s => s.status === 'watching')
    .sort((a, b) => {
      const aDate = a.nextEpisodeDate ? new Date(a.nextEpisodeDate).getTime() : Infinity
      const bDate = b.nextEpisodeDate ? new Date(b.nextEpisodeDate).getTime() : Infinity
      if (aDate !== bDate) return aDate - bDate
      return a.title.localeCompare(b.title)
    })

  const year = calMonth.getFullYear()
  const month = calMonth.getMonth()
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const calCells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (calCells.length % 7 !== 0) calCells.push(null)

  const monthLabel = calMonth.toLocaleString('default', { month: 'long', year: 'numeric' })

  function handleDayClick(day: number) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
    setSelectedDate(prev => prev === dateStr ? null : dateStr)
    setVisibleCount(20)
    setCalOpen(false)
  }


  return (
    <div className="flex flex-col h-full">
      {/* Sticky sub-header */}
      <div className="shrink-0 px-4 pb-3 bg-black">
        {/* Segmented control */}
        <div className="flex bg-white/5 rounded-2xl p-1 gap-1">
          <button
            onClick={() => setView('watching')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              view === 'watching'
                ? 'bg-[#1C1C1E] text-[#F5F5F7] shadow'
                : 'text-[#48484A]'
            }`}
          >
            Watching now
          </button>
          <button
            onClick={() => setView('upcoming')}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              view === 'upcoming'
                ? 'bg-[#1C1C1E] text-[#F5F5F7] shadow'
                : 'text-[#48484A]'
            }`}
          >
            Upcoming
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 min-h-0"
      >
        {loading ? (
          <p className="text-sm text-[#48484A] py-12 text-center">Loading...</p>
        ) : view === 'watching' ? (
          watchingNow.length === 0 ? (
            <div className="py-16 text-center">
              <Tv className="w-10 h-10 text-[#2C2C2E] mx-auto mb-3" />
              <p className="text-sm text-[#48484A]">Nothing actively watching right now.</p>
              <p className="text-xs text-[#2C2C2E] mt-1">Series you're mid-way through will appear here.</p>
            </div>
          ) : (
            <SeriesGrid series={watchingNow} loading={false} onSelect={onSelect} viewMode={viewMode} />
          )
        ) : (
          <div>
            {/* Calendar accordion */}
            <div className="bg-[#111111] rounded-2xl border border-white/7 mb-4 mt-2 overflow-hidden">
              {/* Month header */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <button
                  onClick={() => { setCalMonth(addMonths(calMonth, -1)); setSelectedDate(null) }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[#48484A] active:bg-white/5 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCalOpen(prev => !prev)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-[#F5F5F7] active:opacity-60 transition-opacity"
                >
                  {monthLabel}
                  <ChevronDown
                    className="w-3.5 h-3.5 text-[#48484A] transition-transform duration-200"
                    style={{ transform: calOpen ? 'rotate(180deg)' : 'none' }}
                  />
                </button>
                <button
                  onClick={() => { setCalMonth(addMonths(calMonth, 1)); setSelectedDate(null) }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[#48484A] active:bg-white/5 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Collapsible grid */}
              <div
                style={{
                  maxHeight: calOpen ? '320px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.25s ease',
                }}
              >
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-7 mb-2">
                    {DAY_LABELS.map(d => (
                      <div key={d} className="text-center text-[10px] font-medium text-[#48484A] uppercase tracking-wide">
                        {d.slice(0, 1)}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-y-1">
                    {calCells.map((day, i) => {
                      if (!day) return <div key={i} />
                      const pad = (n: number) => String(n).padStart(2, '0')
                      const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
                      const isToday = dateStr === todayStr
                      const isSelected = dateStr === selectedDate
                      const hasEpisode = episodeMap.has(dateStr)
                      const isPast = dateStr < todayStr
                      return (
                        <button
                          key={i}
                          onClick={() => !isPast && handleDayClick(day)}
                          disabled={isPast && !hasEpisode}
                          className="flex flex-col items-center py-1 rounded-lg transition-colors"
                          style={{ backgroundColor: isSelected ? 'rgba(var(--accent-rgb),0.18)' : undefined }}
                        >
                          <span
                            className={`text-sm leading-none font-medium ${
                              isSelected
                                ? 'text-[var(--color-accent)]'
                                : isToday
                                  ? 'text-[var(--color-accent)]'
                                  : isPast
                                    ? 'text-[#2C2C2E]'
                                    : 'text-[#8E8E93]'
                            }`}
                            style={isToday && !isSelected ? { textDecoration: 'underline', textUnderlineOffset: 3 } : undefined}
                          >
                            {day}
                          </span>
                          <div className="h-1.5 mt-0.5 flex items-center justify-center">
                            {hasEpisode && <div className="w-1 h-1 rounded-full bg-[var(--color-accent)]" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Episode list header */}
            {selectedDate && (
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#48484A] uppercase tracking-wider font-medium">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <button onClick={() => setSelectedDate(null)} className="text-[10px] text-[#48484A] active:text-[#8E8E93]">
                  Clear
                </button>
              </div>
            )}

            {listItems.length === 0 ? (
              <div className="py-10 text-center">
                <Calendar className="w-10 h-10 text-[#2C2C2E] mx-auto mb-3" />
                <p className="text-sm text-[#48484A]">
                  {selectedDate ? 'No episodes airing this day.' : 'No upcoming episodes found.'}
                </p>
                {!selectedDate && (
                  <p className="text-xs text-[#2C2C2E] mt-1">Dates update automatically on launch.</p>
                )}
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-2">
                {listItems.slice(0, visibleCount).map(({ date, series: s }, i) => (
                  <button
                    key={`${s.id}-${date}-${i}`}
                    onClick={() => onSelect(s)}
                    className="w-full flex items-center gap-3 p-3 bg-[#111111] rounded-xl border border-white/7 active:bg-[#1C1C1E] transition-colors text-left"
                  >
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-[#1C1C1E] shrink-0">
                      {s.posterPath && (
                        <img src={posterUrl(s.posterPath, 'w185') ?? ''} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#F5F5F7] truncate">{s.title}</p>
                    </div>
                    <div className="shrink-0">
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[rgba(var(--accent-rgb),0.12)] text-[var(--color-accent)] leading-tight">
                        {formatAirDate(date)}
                      </span>
                    </div>
                  </button>
                ))}
                {visibleCount < listItems.length && (
                  <button
                    onClick={() => setVisibleCount(c => c + 20)}
                    className="w-full py-3 text-xs font-medium text-[#48484A] active:text-[#8E8E93] transition-colors"
                  >
                    Load more ({listItems.length - visibleCount} remaining)
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className={`grid gap-2.5 ${viewMode === 'big' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {listItems.slice(0, visibleCount).map(({ date, series: s }, i) => (
                    <button
                      key={`${s.id}-${date}-${i}`}
                      onClick={() => onSelect(s)}
                      className="relative text-left active:opacity-70 transition-opacity"
                    >
                      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#1C1C1E] mb-1 relative">
                        {s.posterPath ? (
                          <img src={posterUrl(s.posterPath, 'w342') ?? ''} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-2">
                            <span className="text-[10px] text-[#48484A] text-center">{s.title}</span>
                          </div>
                        )}
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--color-accent)]/90 text-white leading-tight backdrop-blur-sm">
                          {formatAirDate(date)}
                        </div>
                      </div>
                      <p className={`text-[#8E8E93] leading-tight line-clamp-2 ${viewMode === 'big' ? 'text-[11px]' : 'text-[10px]'}`}>{s.title}</p>
                    </button>
                  ))}
                </div>
                {visibleCount < listItems.length && (
                  <button
                    onClick={() => setVisibleCount(c => c + 20)}
                    className="w-full py-3 mt-2 text-xs font-medium text-[#48484A] active:text-[#8E8E93] transition-colors"
                  >
                    Load more ({listItems.length - visibleCount} remaining)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
