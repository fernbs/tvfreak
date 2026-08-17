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
      <rect width="100" height="100" rx="22" fill="#0D0D0D"/>
      <g fill="var(--color-accent)">
        {/* Row 0: cols 2-8 */}
        <rect x="22" y="10" width="56" height="8"/>
        {/* Row 1: cols 1-9 */}
        <rect x="14" y="18" width="72" height="8"/>
        {/* Rows 2-3: cols 0-10 */}
        <rect x="6" y="26" width="88" height="16"/>
        {/* Rows 4-5: eye sockets empty at cols 2-3 and 7-8 */}
        <rect x="6" y="42" width="16" height="16"/>
        <rect x="38" y="42" width="24" height="16"/>
        <rect x="78" y="42" width="16" height="16"/>
        {/* Rows 6-7: full width */}
        <rect x="6" y="58" width="88" height="16"/>
        {/* Row 8: cols 1-9 */}
        <rect x="14" y="74" width="72" height="8"/>
        {/* Row 9: teeth at cols 1,3,5,7,9 */}
        <rect x="14" y="82" width="8" height="8"/>
        <rect x="30" y="82" width="8" height="8"/>
        <rect x="46" y="82" width="8" height="8"/>
        <rect x="62" y="82" width="8" height="8"/>
        <rect x="78" y="82" width="8" height="8"/>
      </g>
    </svg>
  )
}
