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

      {/* Alien head: wide cranium, narrow chin */}
      <path
        d="M50 9 C22 9 14 29 14 49 C14 68 26 88 50 91 C74 88 86 68 86 49 C86 29 78 9 50 9 Z"
        fill="var(--color-accent)"
      />

      {/* Left eye — large almond tilted inward */}
      <ellipse cx="34" cy="53" rx="13.5" ry="9" fill="#0D0D0D" transform="rotate(-10, 34, 53)" />

      {/* Right eye */}
      <ellipse cx="66" cy="53" rx="13.5" ry="9" fill="#0D0D0D" transform="rotate(10, 66, 53)" />

      {/* Left eye specular highlight */}
      <ellipse cx="29" cy="48" rx="4.5" ry="2.5" fill="rgba(255,255,255,0.38)" transform="rotate(-10, 29, 48)" />

      {/* Right eye specular highlight */}
      <ellipse cx="61" cy="48" rx="4.5" ry="2.5" fill="rgba(255,255,255,0.38)" transform="rotate(10, 61, 48)" />

      {/* Tiny nostrils */}
      <circle cx="46" cy="71" r="2.5" fill="rgba(0,0,0,0.22)" />
      <circle cx="54" cy="71" r="2.5" fill="rgba(0,0,0,0.22)" />
    </svg>
  )
}
