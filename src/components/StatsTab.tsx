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
  if (count === 0) return '#1E1E1E'
  if (count <= 2) return '#312E81'
  if (count <= 5) return '#4338CA'
  return '#818CF8'
}

function buildWeeks(activityByDate: { date: string; count: number }[]) {
  const actMap = new Map(activityByDate.map(d => [d.date, d.count]))
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 181)
  start.setDate(start.getDate() - start.getDay()) // align to Sunday

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
        className="shrink-0 bg-[#0A0A0A] px-4 pb-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
      >
        <div className="flex items-center gap-2">
          <TVFreakIcon size={22} />
          <h1 className="text-lg font-bold text-white">Stats</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5 pt-1">

            {/* Big numbers */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: stats?.totalEpisodes.toLocaleString() ?? '0', label: 'Episodes' },
                { value: `${totalHours.toLocaleString()}h`, label: 'Watched' },
                { value: activeDays.toString(), label: 'Active days' },
              ].map(({ value, label }) => (
                <div key={label} className="bg-[#141414] rounded-2xl p-3.5 text-center border border-white/5">
                  <p className="text-xl font-bold text-white tabular-nums">{value}</p>
                  <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>

            {/* Streak */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: streak.current, label: 'Current streak', unit: streak.current === 1 ? 'day' : 'days' },
                { value: streak.longest, label: 'Longest streak', unit: streak.longest === 1 ? 'day' : 'days' },
              ].map(({ value, label, unit }) => (
                <div key={label} className="bg-[#141414] rounded-2xl p-3.5 border border-white/5">
                  <p className="text-xl font-bold text-[#6366F1] tabular-nums">{value} <span className="text-sm font-normal text-white/40">{unit}</span></p>
                  <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>

            {/* Library breakdown */}
            <div className="bg-[#141414] rounded-2xl p-4 border border-white/5">
              <p className="text-xs text-white/30 uppercase tracking-wider font-medium mb-3">Library · {allSeries.length} series</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(byStatus) as [keyof typeof byStatus, number][]).map(([status, count]) => {
                  const cfg = STATUS_CONFIG[status]
                  return (
                    <div key={status} className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                      <span className="text-sm text-white/70 flex-1">{cfg.label}</span>
                      <span className="text-sm font-semibold text-white tabular-nums">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Activity heatmap */}
            {weeks.length > 0 && (
              <div className="bg-[#141414] rounded-2xl p-4 border border-white/5">
                <p className="text-xs text-white/30 uppercase tracking-wider font-medium mb-3">Activity · last 6 months</p>
                <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  <div style={{ minWidth: `${weeks.length * 12}px` }}>
                    {/* Month labels */}
                    <div className="flex mb-1" style={{ gap: '2px' }}>
                      {weeks.map((week, i) => {
                        const label = monthLabels.find(m => m.colIndex === i)
                        return (
                          <div key={i} style={{ width: 10, flexShrink: 0 }}>
                            {label && (
                              <span className="text-[8px] text-white/25 whitespace-nowrap">{label.label}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {/* Grid */}
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
                {/* Legend */}
                <div className="flex items-center gap-1.5 mt-3 justify-end">
                  <span className="text-[9px] text-white/20">Less</span>
                  {['#1E1E1E', '#312E81', '#4338CA', '#818CF8'].map(c => (
                    <div key={c} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
                  ))}
                  <span className="text-[9px] text-white/20">More</span>
                </div>
              </div>
            )}

            {/* Top shows */}
            {stats && stats.topSeries.length > 0 && (
              <div className="bg-[#141414] rounded-2xl p-4 border border-white/5">
                <p className="text-xs text-white/30 uppercase tracking-wider font-medium mb-3">Most watched</p>
                <div className="space-y-3">
                  {stats.topSeries.map((s, i) => {
                    const pct = stats.topSeries[0].episodeCount > 0
                      ? (s.episodeCount / stats.topSeries[0].episodeCount) * 100
                      : 0
                    return (
                      <div key={s.seriesId}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-white/20 tabular-nums w-4 shrink-0">{i + 1}</span>
                            <span className="text-sm text-white/80 truncate">{s.title}</span>
                          </div>
                          <span className="text-xs text-white/40 tabular-nums shrink-0 ml-2">
                            {s.episodeCount} ep{s.episodeCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="h-[2px] bg-white/6 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#6366F1] rounded-full transition-all duration-500"
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
