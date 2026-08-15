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
      <rect width="100" height="100" rx="22" fill="#0D0D0D" />
      <text
        x="50"
        y="62"
        fontFamily="-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif"
        fontSize="50"
        fontWeight="800"
        fill="#F5F5F7"
        textAnchor="middle"
        letterSpacing="-3"
      >
        tv
      </text>
      <circle cx="73" cy="71" r="6" fill="#FF9F0A" />
    </svg>
  )
}
