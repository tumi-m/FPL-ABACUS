"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/ui/cn";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function overlayClass() {
  return cn(
    "fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]",
    "data-[state=open]:[animation:gaffer-overlay-in_160ms_ease-out]",
  );
}

/**
 * The sheet itself is glass — it floats over the page, which is the one place
 * the material belongs. The scrim behind it stays light so there is still
 * something varied for the pane to refract; a fully opaque backdrop would make
 * the blur invisible and the glass indistinguishable from a flat card.
 */
const contentBase =
  "fixed z-50 glass-lift text-ink-1 focus:outline-none transition-transform dur-base ease-out-quint";

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "center" | "bottom" | "right";
  }
>(({ className, children, side = "center", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={overlayClass()} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        contentBase,
        side === "center" &&
          "left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg p-6 max-h-[85dvh] overflow-auto",
        side === "bottom" &&
          "inset-x-0 bottom-0 rounded-t-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[85dvh] overflow-auto data-[state=open]:[animation:gaffer-sheet-up_240ms_cubic-bezier(.22,1,.36,1)]",
        side === "right" && "inset-y-0 right-0 w-full max-w-md p-6 overflow-auto",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex flex-col gap-1", className)} {...props} />;
}

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-medium tracking-tight", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-ink-2", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription };

export const Sheet = Dialog;
export const SheetTrigger = DialogTrigger;
export const SheetClose = DialogClose;
export const SheetContent = DialogContent;
export const SheetTitle = DialogTitle;
