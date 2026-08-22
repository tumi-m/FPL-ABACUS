import { redirect } from "next/navigation";

export const metadata = { title: "Board" };

/** The Board arrives with Phase E; the planner keeps the seat warm. */
export default function BoardPage() {
  redirect("/planner");
}
