interface Props {
  size?: number
  className?: string
}

export function TVFreakIcon({ size = 24, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
    >
      <rect width="100" height="100" rx="22" fill="#06B6D4" />
      {/* TV body */}
      <rect x="8" y="15" width="84" height="57" rx="11" fill="white" fillOpacity="0.95" />
      {/* Screen */}
      <rect x="15" y="22" width="70" height="43" rx="7" fill="#082530" />
      {/* Glow behind play */}
      <circle cx="50" cy="43.5" r="18" fill="#06B6D4" fillOpacity="0.22" />
      {/* Play triangle */}
      <path d="M43 33 L43 54 L63 43.5 Z" fill="white" fillOpacity="0.92" />
      {/* Stand */}
      <rect x="43" y="72" width="14" height="8" rx="2" fill="white" fillOpacity="0.75" />
      {/* Base */}
      <rect x="30" y="78" width="40" height="7" rx="3.5" fill="white" fillOpacity="0.75" />
    </svg>
  )
}
