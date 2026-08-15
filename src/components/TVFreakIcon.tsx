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
      <rect x="0" y="0" width="100" height="70" rx="10" fill="#6366F1" />
      <rect x="8" y="8" width="84" height="52" rx="6" fill="#0f172a" />
      <rect x="42" y="70" width="16" height="9" rx="2" fill="#4F46E5" />
      <rect x="28" y="79" width="44" height="8" rx="4" fill="#4F46E5" />
      <path d="M 58 11 L 37 40 L 53 40 L 42 62 L 63 33 L 47 33 Z" fill="#FBBF24" />
    </svg>
  )
}
