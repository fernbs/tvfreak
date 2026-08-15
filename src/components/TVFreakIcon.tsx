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
      <defs>
        <linearGradient id="tvfi-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#tvfi-bg)" />
      <path d="M 61 5 L 78 48 L 56 48 L 39 95 L 22 52 L 44 52 Z" fill="white" />
    </svg>
  )
}
