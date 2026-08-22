import { redirect } from "next/navigation";

// The Board replaced the planner in Phase E — keep old links alive.
export default function PlannerPage() {
  redirect("/board");
}
