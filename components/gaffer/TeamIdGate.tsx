"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/primitives/Input";
import { Button } from "@/components/primitives/Button";
import { X } from "@/components/primitives/icons";
import { formatCompactRank } from "@/lib/ui/format";
import { forgetTeam, getRecentTeams, parseTeamInput, rememberTeam, type RecentTeam } from "@/lib/store/team";

export function TeamIdGate({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [state, setState] = React.useState<"idle" | "checking" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [recent, setRecent] = React.useState<RecentTeam[]>([]);

  React.useEffect(() => {
    setRecent(getRecentTeams());
  }, []);

  async function submit(raw: string) {
    const id = parseTeamInput(raw);
    if (!id) {
      setState("error");
      setError("Enter your team ID — the number on your FPL Points page URL.");
      return;
    }
    setState("checking");
    setError(null);
    try {
      const res = await fetch(`/api/fpl/entry/${id}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { name?: string; summary_overall_rank?: number | null };
      rememberTeam({ id, name: data.name ?? `Team ${id}`, rank: data.summary_overall_rank ?? null });
      router.push("/live");
    } catch {
      setState("error");
      setError("No team with that ID. Check the number on your FPL Points page.");
    }
  }

  return (
    <div className={compact ? "" : "w-full max-w-md"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(value);
        }}
        className="flex gap-2"
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Team ID or pasted FPL URL"
          aria-label="Your FPL team ID"
          aria-invalid={state === "error"}
          className={compact ? "h-9 text-sm" : "h-14 text-base"}
        />
        <Button type="submit" size={compact ? "sm" : "lg"} disabled={state === "checking"}>
          {state === "checking" ? "Checking…" : "Go"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-critical">
          {error}
        </p>
      )}
      {!compact && recent.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Recent</span>
          {recent.map((t) => (
            <span
              key={t.id}
              className="inline-flex h-8 items-center gap-2 rounded-full card-ring pl-3 pr-1.5 text-xs"
            >
              <button
                onClick={() => void submit(String(t.id))}
                className="text-ink-2 hover:text-ink-1"
              >
                {t.name}
                {t.rank ? <span className="ml-1.5 text-ink-3 num-tabular">{formatCompactRank(t.rank)}</span> : null}
              </button>
              <button
                aria-label={`Forget ${t.name}`}
                onClick={() => setRecent(forgetTeam(t.id))}
                className="grid h-5 w-5 place-items-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink-1"
              >
                <X width={11} height={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
