import { permanentRedirect } from "next/navigation";

/**
 * The bonus board lives on the Field now, next to Risk.
 *
 * It was a page of its own for one release, so anything already linking or
 * bookmarked here keeps working — it just lands where the board actually is.
 */
export default function BonusPage(): never {
  permanentRedirect("/field?mode=bonus");
}
