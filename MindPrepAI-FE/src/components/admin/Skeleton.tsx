interface SkeletonProps {
  className?: string;
  rows?: number;
}

export function Skeleton({ className = "", rows = 4 }: SkeletonProps) {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-gray-800 rounded-lg h-10 mb-2" />
      ))}
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <div className="bg-gray-800 rounded-lg h-10" />
      <div className="bg-gray-800/70 rounded-lg h-10" />
      <div className="bg-gray-800/70 rounded-lg h-10" />
      <div className="bg-gray-800/70 rounded-lg h-10" />
      <div className="bg-gray-800/70 rounded-lg h-10" />
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-gray-800/70 rounded-2xl h-32 animate-pulse" />
      ))}
    </div>
  );
}
