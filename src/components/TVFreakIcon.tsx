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
        <radialGradient id="tvf-bg" cx="50%" cy="25%" r="75%">
          <stop offset="0%" stopColor="#1a3a6e" />
          <stop offset="100%" stopColor="#060C16" />
        </radialGradient>
      </defs>

      {/* Background */}
      <rect width="100" height="100" rx="22" fill="url(#tvf-bg)" />

      {/* TV body with blue tint border */}
      <rect x="8" y="14" width="84" height="57" rx="11" fill="#0D1926" />
      <rect x="8" y="14" width="84" height="57" rx="11" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeOpacity="0.35" />

      {/* Screen */}
      <rect x="15" y="21" width="70" height="43" rx="7" fill="#040810" />

      {/* Eye glow halos */}
      <circle cx="34" cy="40" r="12" fill="#3B82F6" fillOpacity="0.13" />
      <circle cx="66" cy="40" r="12" fill="#3B82F6" fillOpacity="0.13" />

      {/* Left eye */}
      <circle cx="34" cy="40" r="7.5" fill="#1E3A8A" />
      <circle cx="34" cy="40" r="5.5" fill="#3B82F6" />
      <circle cx="34" cy="40" r="2.5" fill="#040810" />
      <circle cx="32" cy="38" r="1.2" fill="white" fillOpacity="0.75" />

      {/* Right eye */}
      <circle cx="66" cy="40" r="7.5" fill="#1E3A8A" />
      <circle cx="66" cy="40" r="5.5" fill="#3B82F6" />
      <circle cx="66" cy="40" r="2.5" fill="#040810" />
      <circle cx="64" cy="38" r="1.2" fill="white" fillOpacity="0.75" />

      {/* Sinister curved mouth */}
      <path d="M37 55 Q50 64 63 55" stroke="#3B82F6" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeOpacity="0.8" />

      {/* Stand */}
      <rect x="43" y="71" width="14" height="8" rx="2" fill="#0D1926" />
      {/* Base */}
      <rect x="30" y="77" width="40" height="7" rx="3.5" fill="#0D1926" />
    </svg>
  )
}
