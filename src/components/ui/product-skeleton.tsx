export function ProductSkeleton() {
  return (
    <div className="satin-panel overflow-hidden rounded-[26px] border border-white/10">
      <div className="h-56 animate-pulse bg-white/6" />
      <div className="space-y-4 p-5">
        <div className="flex gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-white/8" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-white/8" />
        </div>
        <div className="space-y-2">
          <div className="h-6 w-3/4 animate-pulse rounded-full bg-white/8" />
          <div className="h-4 w-full animate-pulse rounded-full bg-white/8" />
          <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/8" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-10 w-24 animate-pulse rounded-full bg-white/8" />
          <div className="h-10 w-28 animate-pulse rounded-full bg-white/8" />
        </div>
      </div>
    </div>
  )
}
