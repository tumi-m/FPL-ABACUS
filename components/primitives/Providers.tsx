"use client";

import * as React from "react";
import { TooltipProvider } from "@/components/primitives/Tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={300}>
      {children}
    </TooltipProvider>
  );
}
