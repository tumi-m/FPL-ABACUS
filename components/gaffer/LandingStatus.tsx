"use client";

import useSWR from "swr";
import { StatusPanel } from "@/components/gaffer/LiveStatus";
import type { LiveBarData } from "@/lib/ui/types";

/**
 * The week's state on the landing page.
 *
 * Client-side on purpose: the landing page is static and the team-ID gate has
 * to be usable the instant the HTML lands, so the status arrives a beat later
 * on its own request rather than holding the page open. Until it does, the
 * space it will take is reserved so nothing jumps.
 */
export function LandingStatus() {
  const { data } = useSWR<LiveBarData>(
    "gaffer-status",
    async () => {
      const res = await fetch("/api/gaffer/status");
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as LiveBarData;
    },
    { revalidateOnFocus: false, dedupingInterval: 60_000, shouldRetryOnError: false },
  );

  return (
    <div className="mt-6 flex min-h-[2.75rem] w-full items-center justify-center">
      {data ? <StatusPanel data={data} /> : null}
    </div>
  );
}
