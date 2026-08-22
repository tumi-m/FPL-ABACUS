import * as React from "react";
import { cn } from "@/lib/ui/cn";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md bg-surface-1 px-3 py-2 text-base text-ink-1 card-ring transition-colors dur-instant placeholder:text-ink-3 focus-visible:bg-surface-2 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
