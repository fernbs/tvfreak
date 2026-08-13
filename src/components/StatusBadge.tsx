import type { SeriesStatus } from '../types'
import { STATUS_CONFIG } from '../types'

interface Props {
  status: SeriesStatus
  className?: string
}

export function StatusBadge({ status, className = '' }: Props) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bgClass} ${config.textClass} ${className}`}
    >
      {config.label}
    </span>
  )
}
