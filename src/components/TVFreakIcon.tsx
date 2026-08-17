interface Props {
  size?: number
  className?: string
}

// 10-col × 11-row pixel skull. P=8, offsetX=10, offsetY=6 inside 100×100 viewBox.
// Eyes are cross (+) shaped — corners stay filled. Symmetric around col 4.5.
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
        {/* Row 0: cranium top — cols 2-7 (6 wide) */}
        <rect x="26" y="6"  width="48" height="8"/>
        {/* Row 1: cols 1-8 (8 wide) */}
        <rect x="18" y="14" width="64" height="8"/>
        {/* Row 2: full width (cols 0-9) */}
        <rect x="10" y="22" width="80" height="8"/>
        {/* Row 3: full */}
        <rect x="10" y="30" width="80" height="8"/>
        {/* Row 4: eye cross top — holes at col 2 (left) and col 7 (right) */}
        <rect x="10" y="38" width="16" height="8"/>
        <rect x="34" y="38" width="32" height="8"/>
        <rect x="74" y="38" width="16" height="8"/>
        {/* Row 5: eye cross mid — holes at cols 1-3 (left) and cols 6-8 (right) */}
        <rect x="10" y="46" width="8"  height="8"/>
        <rect x="42" y="46" width="16" height="8"/>
        <rect x="82" y="46" width="8"  height="8"/>
        {/* Row 6: eye cross bottom — same as row 4 */}
        <rect x="10" y="54" width="16" height="8"/>
        <rect x="34" y="54" width="32" height="8"/>
        <rect x="74" y="54" width="16" height="8"/>
        {/* Row 7: full */}
        <rect x="10" y="62" width="80" height="8"/>
        {/* Row 8: nose — holes at cols 4-5 */}
        <rect x="10" y="70" width="32" height="8"/>
        <rect x="58" y="70" width="32" height="8"/>
        {/* Row 9: jaw full */}
        <rect x="10" y="78" width="80" height="8"/>
        {/* Row 10: 3 teeth — cols 1-2, 4-5, 7-8 */}
        <rect x="18" y="86" width="16" height="8"/>
        <rect x="42" y="86" width="16" height="8"/>
        <rect x="66" y="86" width="16" height="8"/>
      </g>
    </svg>
  )
}
