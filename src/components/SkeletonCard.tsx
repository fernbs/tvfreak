export function SkeletonCard() {
  return (
    <div className="relative aspect-[2/3] rounded-xl overflow-hidden animate-pulse bg-[#1C1830]">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[rgba(167,139,250,0.08)]" />
    </div>
  )
}
