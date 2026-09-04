import { Skeleton } from "@/components/primitives/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-56 rounded-md" />
      <Skeleton className="h-11 w-full max-w-md rounded-md" />
      <Skeleton className="h-40 rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}