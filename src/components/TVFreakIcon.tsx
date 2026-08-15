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
      <rect width="100" height="100" rx="22" fill="#0C0A14" />

      {/* TV body */}
      <rect x="6" y="13" width="88" height="60" rx="12" fill="#1C1830" />
      <rect x="6" y="13" width="88" height="60" rx="12" fill="none" stroke="rgba(167,139,250,0.18)" strokeWidth="2" />

      {/* Screen */}
      <rect x="15" y="22" width="70" height="42" rx="7" fill="#0C0A14" />

      {/* Lightning bolt — violet */}
      <path d="M57 25 L36 48 L51 48 L43 71 L64 46 L49 46 Z" fill="#B39DFF" />

      {/* Stand */}
      <rect x="42" y="73" width="16" height="8" rx="2" fill="#1C1830" />
      {/* Base */}
      <rect x="29" y="79" width="42" height="7" rx="3.5" fill="#1C1830" />
    </svg>
  )
}
