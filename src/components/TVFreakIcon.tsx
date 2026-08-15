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
      <rect width="100" height="100" rx="22" fill="#0D0D0D" />

      {/* TV bezel */}
      <rect x="10" y="20" width="80" height="58" rx="9" fill="#1A1A1A" />
      <rect x="10" y="20" width="80" height="58" rx="9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />

      {/* Screen */}
      <rect x="16" y="26" width="68" height="46" rx="6" fill="#070707" />

      {/* Eye — iris (orange) */}
      <circle cx="40" cy="49" r="13" fill="#FF6B00" />
      {/* Pupil */}
      <circle cx="40" cy="49" r="5.5" fill="#070707" />
      {/* Shine */}
      <circle cx="45" cy="44" r="2.5" fill="rgba(255,255,255,0.75)" />

      {/* Lightning bolt — the FREAK element */}
      <path
        d="M68 28 L59 48 L65 48 L56 72"
        fill="none"
        stroke="#FF6B00"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* TV stand legs */}
      <rect x="43" y="78" width="14" height="5" rx="2.5" fill="#1A1A1A" />
      <rect x="35" y="83" width="30" height="5" rx="2.5" fill="#1A1A1A" />
    </svg>
  )
}
