import { cn } from "@/lib/ui/cn";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--surface-1)_0%,var(--surface-3)_40%,var(--surface-1)_80%)] bg-[length:400px_100%]", className)}
      {...props}
    />
  );
}

export { Skeleton };
