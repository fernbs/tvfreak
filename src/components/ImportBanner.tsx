interface Props {
  done: number
  total: number
}

export function ImportBanner({ done, total }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[400px] max-w-[calc(100vw-32px)] bg-[#1C1C1E] border border-white/12 rounded-2xl p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[#F5F5F7]">Importing your library</span>
        <span className="text-sm text-[#8E8E93]">{done} / {total}</span>
      </div>
      <div className="w-full h-[3px] bg-white/7 rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-[#48484A] mt-2">
        Fetching posters from TMDB...
      </p>
    </div>
  )
}
