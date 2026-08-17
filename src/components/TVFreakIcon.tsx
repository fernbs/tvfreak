interface Props {
  size?: number
  className?: string
}

// 13-column pixel skull: 3-wide eye sockets, nasal cavity row, 6 symmetric teeth
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
        {/* Row 0: cranium top — cols 3-9 */}
        <rect x="25.5" y="15" width="49" height="7"/>
        {/* Row 1: cols 2-10 */}
        <rect x="18.5" y="22" width="63" height="7"/>
        {/* Row 2: cols 1-11 */}
        <rect x="11.5" y="29" width="77" height="7"/>
        {/* Row 3: full — cols 0-12 */}
        <rect x="4.5" y="36" width="91" height="7"/>
        {/* Row 4: eye sockets empty at 1-3 and 9-11; filled at 0, 4-8, 12 */}
        <rect x="4.5" y="43" width="7" height="7"/>
        <rect x="32.5" y="43" width="35" height="7"/>
        <rect x="88.5" y="43" width="7" height="7"/>
        {/* Row 5: nasal cavity — filled at 0, 4, 8, 12 only */}
        <rect x="4.5" y="50" width="7" height="7"/>
        <rect x="32.5" y="50" width="7" height="7"/>
        <rect x="60.5" y="50" width="7" height="7"/>
        <rect x="88.5" y="50" width="7" height="7"/>
        {/* Row 6: full jaw — cols 0-12 */}
        <rect x="4.5" y="57" width="91" height="7"/>
        {/* Row 7: lower jaw — cols 1-11 */}
        <rect x="11.5" y="64" width="77" height="7"/>
        {/* Row 8: teeth at cols 1,3,5,7,9,11 */}
        <rect x="11.5" y="71" width="7" height="7"/>
        <rect x="25.5" y="71" width="7" height="7"/>
        <rect x="39.5" y="71" width="7" height="7"/>
        <rect x="53.5" y="71" width="7" height="7"/>
        <rect x="67.5" y="71" width="7" height="7"/>
        <rect x="81.5" y="71" width="7" height="7"/>
      </g>
    </svg>
  )
}
