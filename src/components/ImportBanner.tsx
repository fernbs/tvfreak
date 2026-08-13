interface Props {
  done: number
  total: number
}

export function ImportBanner({ done, total }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[400px] max-w-[calc(100vw-32px)] bg-[#1E1E1E] border border-white/10 rounded-xl p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white">Importing your library</span>
        <span className="text-sm text-white/50">{done} / {total}</span>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#6366F1] rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-white/40 mt-2">
        Fetching posters from TMDB...
      </p>
    </div>
  )
}
