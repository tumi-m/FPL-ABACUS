import Link from "next/link";
import { ArcadeClient } from "@/components/gaffer/arcade/ArcadeClient";
import { PageHeader } from "@/components/gaffer/PageHeader";

export const metadata = { title: "The Arcade",
  description: "Pick which gaffer talks to you — and change team." };

export default function ArcadePage() {
  return (
    <div className="space-y-4">
      {/* broadcast lower-third — match-graphic header per style guide §7 */}
      <PageHeader
        title="The Arcade"
        meta="Pick your gaffer · the voice follows you across the app"
        action={
          /* The badge in the header opens this page, so this is where the
             team gate stays reachable on a phone — the desktop header keeps
             the team pill for the same job. */
          <Link
            href="/"
            className="skewed inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md card-ring px-3 text-2xs uppercase-label text-ink-mid transition-colors dur-instant hover:bg-surface-3 hover:text-ink-hi"
          >
            <span>Change team</span>
          </Link>
        }
      />

      <ArcadeClient />
    </div>
  );
}
