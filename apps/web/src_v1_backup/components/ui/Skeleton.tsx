interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function StoreCardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4 rounded-full" />
            <Skeleton className="h-3 w-1/2 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-4/5 rounded-full" />
        <Skeleton className="h-4 w-2/5 rounded-full" />
        <Skeleton className="h-8 w-full rounded-full mt-1" />
      </div>
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4 rounded-full" />
        <Skeleton className="h-3 w-1/2 rounded-full" />
      </div>
      <Skeleton className="w-16 h-8 rounded-full flex-shrink-0" />
    </div>
  );
}
