import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { TVFreakIcon } from './TVFreakIcon'
import { getAppStats } from '../lib/api'
import type { AppStats } from '../lib/api'
import type { Series } from '../types'
import { STATUS_CONFIG } from '../types'

interface Props {
  allSeries: Series[]
}

function heatColor(count: number): string {
  if (count === 0) return '#1C1C1E'
  if (count <= 2) return '#7A3B0A'
  if (count <= 5) return '#B85C0A'
  return '#FF9F0A'
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

function getMonthLabels(weeks: { date: string }[][]): { label: string; colIndex: number }[] {
  const labels: { label: string; colIndex: number }[] = []
  let lastMonth = ''
  weeks.forEach((week, i) => {
    const month = new Date(week[0].date).toLocaleString('default', { month: 'short' })
    if (month !== lastMonth) { labels.push({ label: month, colIndex: i }); lastMonth = month }
  })
  return labels
}

export function StatsTab({ allSeries }: Props) {
  const [stats, setStats] = useState<AppStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAppStats().then(setStats).finally(() => setLoading(false))
  }, [])

  const totalHours = Math.round((stats?.totalEpisodes ?? 0) * 45 / 60)
  const activeDays = stats?.activityByDate?.length ?? 0

  const byStatus = {
    watching: allSeries.filter(s => s.status === 'watching').length,
    plantowatch: allSeries.filter(s => s.status === 'plantowatch').length,
    completed: allSeries.filter(s => s.status === 'completed').length,
    dropped: allSeries.filter(s => s.status === 'dropped').length,
  }

  const streak = stats ? computeStreak(stats.activityByDate) : { current: 0, longest: 0 }
  const weeks = stats ? buildWeeks(stats.activityByDate) : []
  const monthLabels = getMonthLabels(weeks)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="shrink-0 bg-black px-4 pb-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <div className="flex items-center gap-2">
          <TVFreakIcon size={24} />
          <h1 className="text-xl font-bold text-[#F5F5F7]">Stats</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-[#48484A] animate-spin" />
          </div>
        ) : (
          <div className="space-y-4 pt-1">

            {/* Big numbers */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: stats?.totalEpisodes.toLocaleString() ?? '0', label: 'Episodes' },
                { value: `${totalHours.toLocaleString()}h`, label: 'Watched' },
                { value: activeDays.toString(), label: 'Active days' },
              ].map(({ value, label }) => (
                <div key={label} className="bg-[#111111] rounded-2xl p-4 text-center border border-white/7">
                  <p className="text-2xl font-bold text-[#F5F5F7] tabular-nums leading-none">{value}</p>
                  <p className="text-[10px] text-[#48484A] mt-1.5 uppercase tracking-wider font-medium">{label}</p>
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
                  <p className="text-2xl font-bold text-[#FF9F0A] tabular-nums leading-none">
                    {value} <span className="text-sm font-normal text-[#48484A]">{unit}</span>
                  </p>
                  <p className="text-[10px] text-[#48484A] mt-1.5 uppercase tracking-wider font-medium">{label}</p>
                </div>
              ))}
            </div>

            {/* Library breakdown */}
            <div className="bg-[#111111] rounded-2xl p-4 border border-white/7">
              <p className="text-[10px] text-[#48484A] uppercase tracking-widest font-semibold mb-3">
                Library · {allSeries.length} series
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(byStatus) as [keyof typeof byStatus, number][]).map(([status, count]) => {
                  const cfg = STATUS_CONFIG[status]
                  return (
                    <div key={status} className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                      <span className="text-sm text-[#8E8E93] flex-1">{cfg.label}</span>
                      <span className="text-sm font-semibold text-[#F5F5F7] tabular-nums">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

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
                  {['#1C1C1E', '#7A3B0A', '#B85C0A', '#FF9F0A'].map(c => (
                    <div key={c} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
                  ))}
                  <span className="text-[9px] text-[#48484A]">More</span>
                </div>
              </div>
            )}

            {/* Top shows */}
            {stats && stats.topSeries.length > 0 && (
              <div className="bg-[#111111] rounded-2xl p-4 border border-white/7">
                <p className="text-[10px] text-[#48484A] uppercase tracking-widest font-semibold mb-3">Most watched</p>
                <div className="space-y-3">
                  {stats.topSeries.map((s, i) => {
                    const pct = stats.topSeries[0].episodeCount > 0
                      ? (s.episodeCount / stats.topSeries[0].episodeCount) * 100
                      : 0
                    return (
                      <div key={s.seriesId}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-[#2C2C2E] tabular-nums w-4 shrink-0">{i + 1}</span>
                            <span className="text-sm text-[#F5F5F7] truncate">{s.title}</span>
                          </div>
                          <span className="text-xs text-[#48484A] tabular-nums shrink-0 ml-2">
                            {s.episodeCount} ep{s.episodeCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="h-[3px] bg-white/7 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#FF9F0A] rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
