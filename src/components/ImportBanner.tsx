interface Props {
  done: number
  total: number
}

export function ImportBanner({ done, total }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[400px] max-w-[calc(100vw-32px)] bg-[#1C1830] border border-[rgba(167,139,250,0.15)] rounded-2xl p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[#F0ECFF]">Importing your library</span>
        <span className="text-sm text-[#9B8EC4]">{done} / {total}</span>
      </div>
      <div className="w-full h-[3px] bg-[rgba(167,139,250,0.1)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#7C3AED] rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-[#4A3F6E] mt-2">
        Fetching posters from TMDB...
      </p>
    </div>
  )
}
