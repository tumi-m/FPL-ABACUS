import { Skeleton } from "@/components/primitives/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-56 rounded-md" />
      <Skeleton className="h-11 w-full max-w-md rounded-md" />
      <Skeleton className="h-[42dvh] min-h-[280px] rounded-lg" />
      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
        <Skeleton className="h-[24rem] rounded-lg" />
      </div>
    </div>
  );
}