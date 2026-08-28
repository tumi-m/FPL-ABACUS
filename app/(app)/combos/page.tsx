import { permanentRedirect } from "next/navigation";

/**
 * The combination board is a sub-page of the Field now, beside Club numbers
 * and Points contribution.
 *
 * It shipped at the top level for one release. Anything already linking or
 * bookmarked here keeps working — it just lands where the board actually is.
 */
export default function CombosPage(): never {
  permanentRedirect("/field/combos");
}
