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
      <rect x="13" y="22" width="74" height="48" rx="9" fill="white" fillOpacity="0.9" />
      <rect x="21" y="30" width="58" height="32" rx="5" fill="#0891B2" />
      <rect x="43" y="70" width="14" height="9" rx="2" fill="white" fillOpacity="0.9" />
      <rect x="32" y="77" width="36" height="6" rx="3" fill="white" fillOpacity="0.9" />
    </svg>
  )
}
