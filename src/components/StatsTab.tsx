import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { getAppStats } from '../lib/api'
import type { AppStats } from '../lib/api'
import type { Series, Movie, SeriesStatus, MovieStatus } from '../types'
import { STATUS_CONFIG, MOVIE_STATUS_CONFIG } from '../types'

interface Props {
  allSeries: Series[]
  allMovies: Movie[]
}

function computeStreak(activityByDate: { date: string; count: number }[]): { current: number; longest: number } {
  const dates = activityByDate.map(d => d.date).sort()
  if (dates.length === 0) return { current: 0, longest: 0 }

  let longest = 1
  let runLen = 1
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000
    if (diff === 1) { runLen++; longest = Math.max(longest, runLen) }
    else runLen = 1
  }

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const lastDate = dates[dates.length - 1]
  let current = 0
  if (lastDate === today || lastDate === yesterday) {
    current = 1
    for (let i = dates.length - 2; i >= 0; i--) {
      const diff = (new Date(dates[i + 1]).getTime() - new Date(dates[i]).getTime()) / 86400000
      if (diff === 1) current++
      else break
    }
  }
  return { current, longest }
}

function buildWeeks(activityByDate: { date: string; count: number }[]) {
  const actMap = new Map(activityByDate.map(d => [d.date, d.count]))
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 181)
  start.setDate(start.getDate() - start.getDay())

  const weeks: { date: string; count: number; future: boolean }[][] = []
  const cur = new Date(start)
  while (cur <= today) {
    const week: { date: string; count: number; future: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const dateStr = cur.toISOString().slice(0, 10)
      week.push({ date: dateStr, count: actMap.get(dateStr) ?? 0, future: cur > today })
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function heatColor(count: number): string {
  if (count === 0) return '#1C1C1E'
  if (count <= 2) return '#3D1472'
  if (count <= 5) return '#7B2EBC'
  return 'var(--color-accent)'
}

function getMonthLabels(weeks: { date: string }[][]): { label: string; colIndex: number }[] {
  const labels: { label: string; colIndex: number }[] = []
  let lastMonth = ''
  weeks.forEach((week, i) => {
    const month = new Date(week[0].date).toLocaleString('default', { month: 'short' })
    if (month !== lastMonth) { labels.push({ label: month, colIndex: i }); lastMonth = month }
  })
  return labels
}

function buildMonthlyBars(activityByDate: { date: string; count: number }[]) {
  const monthMap = new Map<string, number>()
  for (const { date, count } of activityByDate) {
    const month = date.slice(0, 7)
    monthMap.set(month, (monthMap.get(month) ?? 0) + count)
  }
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { label: d.toLocaleString('default', { month: 'short' }), count: monthMap.get(key) ?? 0 }
  })
}

const CIRCUM = 2 * Math.PI * 38

interface DonutSegment { color: string; count: number; label: string }

function DonutChart({ data, total }: { data: DonutSegment[]; total: number }) {
  const segments = data.filter(d => d.count > 0)

  if (total === 0 || segments.length === 0) {
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="50" r="38" fill="none" stroke="#2C2C2E" strokeWidth="13" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fill="#48484A" fontSize="16" fontWeight="600">0</text>
      </svg>
    )
  }

  let cum = 0
  const arcs = segments.map(seg => {
    const len = (seg.count / total) * CIRCUM
    const offset = cum
    cum += len
    return { ...seg, len, offset }
  })

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="38" fill="none" stroke="#2C2C2E" strokeWidth="13" />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx="50" cy="50" r="38"
          fill="none"
          stroke={arc.color}
          strokeWidth="13"
          strokeDasharray={`${arc.len} ${CIRCUM}`}
          strokeDashoffset={-arc.offset}
          transform="rotate(-90 50 50)"
          strokeLinecap="butt"
        />
      ))}
      <text x="50" y="47" textAnchor="middle" dominantBaseline="middle" fill="#F5F5F7" fontSize="19" fontWeight="700">{total}</text>
      <text x="50" y="62" textAnchor="middle" dominantBaseline="middle" fill="#48484A" fontSize="8" letterSpacing="1">TOTAL</text>
    </svg>
  )
}

export function StatsTab({ allSeries, allMovies }: Props) {
  const [stats, setStats] = useState<AppStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAppStats().then(setStats).finally(() => setLoading(false))
  }, [])

  const totalSeries = allSeries.length
  const totalMovies = allMovies.length
  const totalEpisodes = stats?.totalEpisodes ?? 0
  const totalHours = Math.round(totalEpisodes * 45 / 60)

  const seriesByStatus: Record<SeriesStatus, number> = {
    watching:    allSeries.filter(s => s.status === 'watching').length,
    completed:   allSeries.filter(s => s.status === 'completed').length,
    dropped:     allSeries.filter(s => s.status === 'dropped').length,
    plantowatch: allSeries.filter(s => s.status === 'plantowatch').length,
  }

  const moviesByStatus: Record<MovieStatus, number> = {
    watching:    allMovies.filter(m => m.status === 'watching').length,
    completed:   allMovies.filter(m => m.status === 'completed').length,
    dropped:     allMovies.filter(m => m.status === 'dropped').length,
    plantowatch: allMovies.filter(m => m.status === 'plantowatch').length,
  }

  const statusOrder: SeriesStatus[] = ['watching', 'completed', 'plantowatch', 'dropped']
  const movieStatusOrder: MovieStatus[] = ['watching', 'completed', 'plantowatch', 'dropped']

  const seriesDonutData: DonutSegment[] = statusOrder.map(s => ({
    color: STATUS_CONFIG[s].color,
    count: seriesByStatus[s],
    label: STATUS_CONFIG[s].label,
  }))

  const movieDonutData: DonutSegment[] = movieStatusOrder.map(s => ({
    color: MOVIE_STATUS_CONFIG[s].color,
    count: moviesByStatus[s],
    label: MOVIE_STATUS_CONFIG[s].label,
  }))

  const streak = stats ? computeStreak(stats.activityByDate) : { current: 0, longest: 0 }
  const weeks = stats ? buildWeeks(stats.activityByDate) : []
  const monthLabels = getMonthLabels(weeks)
  const monthlyBars = stats ? buildMonthlyBars(stats.activityByDate) : []
  const maxBar = Math.max(...monthlyBars.map(b => b.count), 1)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-2 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-[#48484A] animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 pt-1">

            {/* Key numbers */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: totalSeries, label: 'Series', sub: `${seriesByStatus.watching} watching` },
                { value: totalMovies, label: 'Films', sub: `${moviesByStatus.completed} watched` },
                { value: totalEpisodes.toLocaleString(), label: 'Episodes' },
                { value: `${totalHours.toLocaleString()}h`, label: 'Watch time' },
              ].map(({ value, label, sub }) => (
                <div key={label} className="bg-[#111111] rounded-2xl p-4 border border-white/7">
                  <p className="text-2xl font-bold text-[#F5F5F7] tabular-nums leading-none">{value}</p>
                  <p className="text-[10px] text-[#48484A] mt-1.5 uppercase tracking-wider font-medium">{label}</p>
                  {sub && <p className="text-[10px] text-[#48484A] mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>

            {/* Status donut charts */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: 'Series', donutData: seriesDonutData, total: totalSeries },
                { title: 'Films', donutData: movieDonutData, total: totalMovies },
              ].map(({ title, donutData, total }) => (
                <div key={title} className="bg-[#111111] rounded-2xl p-4 border border-white/7">
                  <p className="text-[10px] text-[#48484A] uppercase tracking-widest font-semibold mb-3">{title}</p>
                  <div className="w-28 h-28 mx-auto mb-3">
                    <DonutChart data={donutData} total={total} />
                  </div>
                  <div className="space-y-1.5">
                    {donutData.filter(d => d.count > 0).map(d => (
                      <div key={d.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-[11px] text-[#8E8E93]">{d.label}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-[#F5F5F7] tabular-nums">{d.count}</span>
                      </div>
                    ))}
                    {donutData.every(d => d.count === 0) && (
                      <p className="text-[11px] text-[#48484A] text-center">Nothing added yet</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Streak */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: streak.current, label: 'Current streak', unit: streak.current === 1 ? 'day' : 'days' },
                { value: streak.longest, label: 'Longest streak', unit: streak.longest === 1 ? 'day' : 'days' },
              ].map(({ value, label, unit }) => (
                <div key={label} className="bg-[#111111] rounded-2xl p-4 border border-white/7">
                  <p className="text-2xl font-bold text-[var(--color-accent)] tabular-nums leading-none">
                    {value} <span className="text-sm font-normal text-[#48484A]">{unit}</span>
                  </p>
                  <p className="text-[10px] text-[#48484A] mt-1.5 uppercase tracking-wider font-medium">{label}</p>
                </div>
              ))}
            </div>

            {/* Monthly bar chart */}
            {monthlyBars.some(b => b.count > 0) && (
              <div className="bg-[#111111] rounded-2xl p-4 border border-white/7">
                <p className="text-[10px] text-[#48484A] uppercase tracking-widest font-semibold mb-4">Episodes per month</p>
                <div className="flex items-end gap-2" style={{ height: 80 }}>
                  {monthlyBars.map(bar => (
                    <div key={bar.label} className="flex-1 flex flex-col items-center justify-end gap-1">
                      {bar.count > 0 && (
                        <span className="text-[9px] text-[#48484A] tabular-nums">{bar.count}</span>
                      )}
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: bar.count > 0 ? `${Math.max(4, (bar.count / maxBar) * 52)}px` : '3px',
                          backgroundColor: bar.count > 0 ? 'var(--color-accent)' : '#2C2C2E',
                          opacity: bar.count > 0 ? 0.85 : 1,
                        }}
                      />
                      <span className="text-[9px] text-[#48484A]">{bar.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity heatmap */}
            {weeks.length > 0 && (
              <div className="bg-[#111111] rounded-2xl p-4 border border-white/7">
                <p className="text-[10px] text-[#48484A] uppercase tracking-widest font-semibold mb-3">
                  Activity · last 6 months
                </p>
                <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  <div style={{ minWidth: `${weeks.length * 12}px` }}>
                    <div className="flex mb-1" style={{ gap: '2px' }}>
                      {weeks.map((week, i) => {
                        const label = monthLabels.find(m => m.colIndex === i)
                        return (
                          <div key={i} style={{ width: 10, flexShrink: 0 }}>
                            {label && (
                              <span className="text-[8px] text-[#48484A] whitespace-nowrap">{label.label}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex" style={{ gap: '2px' }}>
                      {weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col" style={{ gap: '2px' }}>
                          {week.map((day, di) => (
                            <div
                              key={di}
                              title={`${day.date}: ${day.count} ep${day.count !== 1 ? 's' : ''}`}
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                backgroundColor: day.future ? 'transparent' : heatColor(day.count),
                              }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 justify-end">
                  <span className="text-[9px] text-[#48484A]">Less</span>
                  {['#1C1C1E', '#3D1472', '#7B2EBC', 'var(--color-accent)'].map(c => (
                    <div key={c} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
                  ))}
                  <span className="text-[9px] text-[#48484A]">More</span>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
