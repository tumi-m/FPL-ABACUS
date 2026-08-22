import { Skeleton } from "@/components/primitives/Skeleton";

export default function LoadingMatchday() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <Skeleton className="hidden h-[70dvh] rounded-lg lg:block" />
    </div>
  );
}
