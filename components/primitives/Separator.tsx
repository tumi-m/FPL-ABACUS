import * as React from "react";
import { cn } from "@/lib/ui/cn";

const Separator = React.forwardRef<
  HTMLHRElement,
  React.HTMLAttributes<HTMLHRElement> & { orientation?: "horizontal" | "vertical"; strong?: boolean }
>(({ className, orientation = "horizontal", strong = false, ...props }, ref) => (
  <hr
    ref={ref}
    role="separator"
    aria-orientation={orientation}
    className={cn(
      "shrink-0 border-0",
      orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
      strong ? "bg-hairline-strong" : "bg-hairline",
      className,
    )}
    {...props}
  />
));
Separator.displayName = "Separator";

export { Separator };
