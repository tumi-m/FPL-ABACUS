import { ArcadeClient } from "@/components/gaffer/arcade/ArcadeClient";
import { PageHeader } from "@/components/gaffer/PageHeader";

export const metadata = { title: "The Arcade" };

export default function ArcadePage() {
  return (
    <div className="space-y-4">
      {/* broadcast lower-third — match-graphic header per style guide §7 */}
      <PageHeader
        title="The Arcade"
        meta="Pick your gaffer · the voice follows you across the app"
      />

      <ArcadeClient />
    </div>
  );
}
