import Link from "next/link";

/** Back navigation with real chrome — 44px target, skewed pill, never bare text. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      role="button"
      className="skewed inline-flex h-11 items-center gap-2 self-start rounded-md bg-raised px-4 text-sm uppercase-label text-ink-mid card-ring transition-colors dur-instant hover:text-ink-hi"
    >
      <span aria-hidden>←</span>
      <span>{label}</span>
    </Link>
  );
}
