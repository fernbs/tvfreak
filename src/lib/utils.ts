export function formatAirDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  if (isNaN(date.getTime())) return dateStr

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date.getTime() - now.getTime()) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 6) return `In ${diffDays} days`
  if (diffDays < -1 && diffDays >= -6) return `${Math.abs(diffDays)} days ago`

  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }

  return date.toLocaleDateString('en-GB', opts)
}

export function isReleased(airDate: string | null | undefined): boolean {
  if (!airDate) return true
  const date = new Date(airDate + 'T00:00:00')
  if (isNaN(date.getTime())) return true
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date <= today
}
