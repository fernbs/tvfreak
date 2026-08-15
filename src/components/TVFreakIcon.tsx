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
      <rect width="100" height="100" rx="22" fill="#6366F1" />
      <path d="M 63 6 L 35 52 L 54 52 L 37 94 L 65 48 L 46 48 Z" fill="white" />
    </svg>
  )
}
