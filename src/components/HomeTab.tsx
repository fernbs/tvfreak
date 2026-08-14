import { useState, useRef, useEffect } from 'react'
import { Tv, Calendar, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Series } from '../types'
import { SeriesCard } from './SeriesCard'
import { formatAirDate } from '../lib/utils'
import { posterUrl } from '../lib/tmdb'

const PULL_THRESHOLD = 64
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Props {
  series: Series[]
  loading: boolean
  onSelect: (s: Series) => void
  onRefresh: () => Promise<void>
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

export function HomeTab({ series, loading, onSelect, onRefresh }: Props) {
  const [view, setView] = useState<'watching' | 'upcoming'>('watching')
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const isPulling = useRef(false)
  const pullDistanceRef = useRef(0)
  const refreshingRef = useRef(false)

  // Non-passive touchmove so we can preventDefault and stop browser overscroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function handleTouchStart(e: TouchEvent) {
      if ((el!.scrollTop ?? 0) === 0) {
        touchStartY.current = e.touches[0].clientY
        isPulling.current = true
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (!isPulling.current || refreshingRef.current) return
      const delta = e.touches[0].clientY - touchStartY.current
      if (delta > 0) {
        e.preventDefault()
        const dist = Math.min(delta * 0.5, PULL_THRESHOLD * 1.2)
        pullDistanceRef.current = dist
        setPullDistance(dist)
      }
    }

    async function handleTouchEnd() {
      if (pullDistanceRef.current >= PULL_THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true
        setRefreshing(true)
        setPullDistance(0)
        pullDistanceRef.current = 0
        try { await onRefresh() } finally {
          refreshingRef.current = false
          setRefreshing(false)
        }
      } else {
        setPullDistance(0)
        pullDistanceRef.current = 0
      }
      isPulling.current = false
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onRefresh])

  const today = new Date()
  const todayStr = toDateStr(today)

  // All series with a future next episode date
  const allUpcoming = series
    .filter(s => s.nextEpisodeDate && s.nextEpisodeDate > todayStr)
    .sort((a, b) => a.nextEpisodeDate!.localeCompare(b.nextEpisodeDate!))

  // Map date → series for calendar dots
  const episodeMap = new Map<string, Series[]>()
  for (const s of allUpcoming) {
    const d = s.nextEpisodeDate!
    if (!episodeMap.has(d)) episodeMap.set(d, [])
    episodeMap.get(d)!.push(s)
  }

  // Episodes for the selected date (or all upcoming if none selected)
  const listSeries = selectedDate
    ? (episodeMap.get(selectedDate) ?? [])
    : allUpcoming

  // Watching Now
  const watchingNow = series
    .filter(s => s.status === 'watching')
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

  // Calendar grid (Mon-first)
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
    // Scroll list into view
    setTimeout(() => scrollRef.current?.scrollTo({ top: 260, behavior: 'smooth' }), 50)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Pull-to-refresh indicator */}
      <div
        className="shrink-0 flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{ height: refreshing ? 36 : pullDistance > 0 ? pullDistance * 0.5 : 0 }}
      >
        <Loader2
          className={`w-5 h-5 text-[#6366F1] transition-all duration-200 ${refreshing ? 'animate-spin' : ''}`}
          style={{ opacity: refreshing ? 1 : Math.min(pullDistance / PULL_THRESHOLD, 1) }}
        />
      </div>

      {/* Sticky header */}
      <div
        className="shrink-0 px-4 pb-3 bg-[#0A0A0A]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)' }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Tv className="w-5 h-5 text-[#6366F1]" />
          <span className="text-lg font-bold tracking-tight text-white">TVFREAK</span>
        </div>

        {/* Toggle */}
        <div className="flex bg-white/6 rounded-xl p-1 gap-1">
          <button
            onClick={() => setView('watching')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'watching' ? 'bg-white/10 text-white' : 'text-white/40'
            }`}
          >
            Watching now
          </button>
          <button
            onClick={() => setView('upcoming')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'upcoming' ? 'bg-white/10 text-white' : 'text-white/40'
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
          <p className="text-sm text-white/25 py-12 text-center">Loading...</p>
        ) : view === 'watching' ? (
          watchingNow.length === 0 ? (
            <div className="py-16 text-center">
              <Tv className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/25">Nothing actively watching right now.</p>
              <p className="text-xs text-white/15 mt-1">Series you're mid-way through will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              {watchingNow.map(s => (
                <SeriesCard key={s.id} series={s} onClick={onSelect} />
              ))}
            </div>
          )
        ) : (
          <div>
            {/* Calendar */}
            <div className="bg-[#141414] rounded-2xl p-4 border border-white/5 mb-4 mt-2">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => { setCalMonth(addMonths(calMonth, -1)); setSelectedDate(null) }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 active:bg-white/8 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-white">{monthLabel}</span>
                <button
                  onClick={() => { setCalMonth(addMonths(calMonth, 1)); setSelectedDate(null) }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 active:bg-white/8 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Weekday labels */}
              <div className="grid grid-cols-7 mb-2">
                {DAY_LABELS.map(d => (
                  <div key={d} className="text-center text-[10px] font-medium text-white/20 uppercase tracking-wide">
                    {d.slice(0, 1)}
                  </div>
                ))}
              </div>

              {/* Day grid */}
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
                      style={{
                        backgroundColor: isSelected ? 'rgba(99,102,241,0.2)' : undefined,
                      }}
                    >
                      <span
                        className={`text-sm leading-none font-medium ${
                          isSelected
                            ? 'text-[#6366F1]'
                            : isToday
                              ? 'text-[#6366F1]'
                              : isPast
                                ? 'text-white/15'
                                : 'text-white/70'
                        }`}
                        style={isToday && !isSelected ? { textDecoration: 'underline', textUnderlineOffset: 3 } : undefined}
                      >
                        {day}
                      </span>
                      <div className="h-1.5 mt-0.5 flex items-center justify-center">
                        {hasEpisode && (
                          <div
                            className="w-1 h-1 rounded-full"
                            style={{ backgroundColor: isSelected ? '#6366F1' : '#6366F1' }}
                          />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Episode list */}
            {selectedDate && (
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white/30 uppercase tracking-wider font-medium">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <button onClick={() => setSelectedDate(null)} className="text-[10px] text-white/25 active:text-white/50">
                  Clear
                </button>
              </div>
            )}

            {listSeries.length === 0 ? (
              <div className="py-10 text-center">
                <Calendar className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/25">
                  {selectedDate ? 'No episodes airing this day.' : 'No upcoming episodes found.'}
                </p>
                {!selectedDate && (
                  <p className="text-xs text-white/15 mt-1">Open a series to refresh its next episode date.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {listSeries.map(s => (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s)}
                    className="w-full flex items-center gap-3 p-3 bg-[#141414] rounded-xl border border-white/6 active:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-[#1E1E1E] shrink-0">
                      {s.posterPath && (
                        <img
                          src={posterUrl(s.posterPath, 'w185') ?? ''}
                          alt={s.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{s.title}</p>
                      {s.nextEpisodeName && (
                        <p className="text-xs text-white/40 mt-0.5 truncate">{s.nextEpisodeName}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-[#6366F1]">
                        {formatAirDate(s.nextEpisodeDate)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
