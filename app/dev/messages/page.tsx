import { notFound } from "next/navigation";
import { MessageGallery } from "@/components/gaffer/MessageGallery";

export const metadata = { title: "Gaffer messages", robots: { index: false, follow: false } };

/**
 * The Gaffer's message cards, out of the round that produces them.
 *
 * These only appear when a goal goes in, so the only way to look at one
 * during a quiet week is to stage it — and a card nobody can look at is a
 * card nobody can check the contrast of. Same gate as the chart gallery.
 */
export default function MessagesGallery() {
  if (process.env.NODE_ENV === "production" && process.env.GAFFER_DEV_CHARTS !== "1") {
    notFound();
  }
  return <MessageGallery />;
}
