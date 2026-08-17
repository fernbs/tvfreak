interface Props {
  size?: number
  className?: string
}

// 12-col × 11-row pixel skull. Eyes are cross (+) shaped — corners stay filled.
// P=8, offsetX=2, offsetY=6 inside 100×100 viewBox.
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
        {/* Row 0: cranium top — cols 2-9 */}
        <rect x="18" y="6" width="64" height="8"/>
        {/* Row 1: cols 1-10 */}
        <rect x="10" y="14" width="80" height="8"/>
        {/* Row 2: full */}
        <rect x="2" y="22" width="96" height="8"/>
        {/* Row 3: eye cross top — E at cols 2 and 8; filled at 0-1,3-7,9-11 */}
        <rect x="2"  y="30" width="16" height="8"/>
        <rect x="26" y="30" width="40" height="8"/>
        <rect x="74" y="30" width="24" height="8"/>
        {/* Row 4: eye cross mid — E at cols 1-3 and 7-9; filled at 0,4-6,10-11 */}
        <rect x="2"  y="38" width="8"  height="8"/>
        <rect x="34" y="38" width="24" height="8"/>
        <rect x="82" y="38" width="16" height="8"/>
        {/* Row 5: eye cross bottom — same as row 3 */}
        <rect x="2"  y="46" width="16" height="8"/>
        <rect x="26" y="46" width="40" height="8"/>
        <rect x="74" y="46" width="24" height="8"/>
        {/* Row 6: full */}
        <rect x="2" y="54" width="96" height="8"/>
        {/* Row 7: nose — E at cols 5-6; filled at 0-4 and 7-11 */}
        <rect x="2"  y="62" width="40" height="8"/>
        <rect x="58" y="62" width="40" height="8"/>
        {/* Row 8: full */}
        <rect x="2" y="70" width="96" height="8"/>
        {/* Row 9: lower jaw — cols 1-10 */}
        <rect x="10" y="78" width="80" height="8"/>
        {/* Row 10: 3 teeth — cols 1-2, 5-6, 9-10 */}
        <rect x="10" y="86" width="16" height="8"/>
        <rect x="42" y="86" width="16" height="8"/>
        <rect x="74" y="86" width="16" height="8"/>
      </g>
    </svg>
  )
}
