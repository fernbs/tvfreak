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
      {/* Background */}
      <rect width="100" height="100" rx="22" fill="#060C16" />

      {/* TV body */}
      <rect x="6" y="13" width="88" height="60" rx="12" fill="#0D1926" />
      <rect x="6" y="13" width="88" height="60" rx="12" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />

      {/* Screen */}
      <rect x="15" y="22" width="70" height="42" rx="7" fill="#020608" />

      {/* Lightning bolt — electric blue, bold, centered */}
      <path d="M57 25 L36 48 L51 48 L43 71 L64 46 L49 46 Z" fill="#3B82F6" />

      {/* Stand */}
      <rect x="42" y="73" width="16" height="8" rx="2" fill="#0D1926" />
      {/* Base */}
      <rect x="29" y="79" width="42" height="7" rx="3.5" fill="#0D1926" />
    </svg>
  )
}
