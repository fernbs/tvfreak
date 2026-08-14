import type { Series } from '../types'
import { SeriesCard } from './SeriesCard'
import { SkeletonCard } from './SkeletonCard'

interface Props {
  series: Series[]
  loading: boolean
  onSelect: (series: Series) => void
}

export function SeriesGrid({ series, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: 18 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (series.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-white/40 text-lg font-medium">Nothing here yet</p>
        <p className="text-white/25 text-sm mt-1">Use the search bar to add your first series</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
      {series.map(s => (
        <SeriesCard key={s.id} series={s} onClick={onSelect} />
      ))}
    </div>
  )
}
