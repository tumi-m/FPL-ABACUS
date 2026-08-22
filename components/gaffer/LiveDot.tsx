import { cn } from "@/lib/ui/cn";

/**
 * The live pulse — style guide §10. An 8px skewed volt square with an expanding
 * box-shadow ring. The ONLY continuously animating element in the app, and only
 * while a fixture is actually in play. Stopped entirely under reduced motion.
 */
export function LiveDot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("live-dot", className)} />;
}
