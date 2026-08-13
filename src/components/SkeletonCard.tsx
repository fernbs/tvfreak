export function SkeletonCard() {
  return (
    <div className="relative aspect-[2/3] rounded-lg overflow-hidden animate-pulse bg-[#1E1E1E]">
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5" />
    </div>
  )
}
