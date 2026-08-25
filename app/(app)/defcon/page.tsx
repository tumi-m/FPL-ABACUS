import { permanentRedirect } from "next/navigation";

/** The DEFCON board moved onto the Field; old links follow it there. */
export default function DefconPage(): never {
  permanentRedirect("/field?mode=defcon");
}
