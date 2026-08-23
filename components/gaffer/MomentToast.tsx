"use client";

import * as React from "react";
import { X } from "@/components/primitives/icons";

/**
 * MomentToast (v5-G) — one dismissible status moment, bottom-centre above the
 * thumb bar. Auto-clears after 8s; never stacks; reduced-motion is handled by
 * the global kill switch.
 */
export function MomentToast({ message, onClose }: { message: string | null; onClose: () => void }) {
  React.useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex justify-center md:bottom-6">
      <div role="status" className="skewed pointer-events-auto flex items-center gap-3 rounded-md bg-raised card-ring px-4 py-2.5 btn-glow">
        <span className="text-sm text-ink-hi">{message}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="relative grid h-8 w-8 place-items-center rounded-sm text-ink-mid transition-colors dur-instant after:absolute after:inset-0 after:content-[''] hover:text-ink-hi"
        >
          <X width={14} height={14} />
        </button>
      </div>
    </div>
  );
}
