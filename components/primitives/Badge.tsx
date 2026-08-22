import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-surface-3 text-ink-2",
        brand: "bg-brand-wash text-brand",
        live: "bg-brand text-brand-ink",
        warning: "bg-warning/15 text-warning",
        critical: "bg-critical/10 text-critical",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
