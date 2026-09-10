import type { Metadata, Viewport } from "next";
import { brand } from "@/config/brand";
import { siteUrl } from "@/lib/siteUrl";
import { fontClassName } from "@/config/fonts";
import { Providers } from "@/components/primitives/Providers";
import "./globals.css";

export const metadata: Metadata = {
  /*
   * The one absolute URL the app needs.
   *
   * Without it Next.js has no way to turn the OG and Twitter card images into
   * absolute URLs, which is the only form the platforms that fetch them
   * accept — so every share of this app has been posting a card that resolves
   * against whatever host the scraper guessed. It also gives every page a
   * canonical, which matters the moment a project has two addresses: a custom
   * domain and the .vercel.app it was born on are the same site to us and two
   * competing copies to a search engine.
   *
   * Resolved rather than written down, so the domain lives in one place —
   * Vercel's project settings — and changing it is not a deploy.
   */
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: "/" },
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
  openGraph: {
    type: "website",
    siteName: brand.name,
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: brand.name, description: brand.description },
};

export const viewport: Viewport = {
  themeColor: brand.themeColor,
  width: "device-width",
  initialScale: 1,
};

const themeScript = `(function(){try{var m=localStorage.getItem('gaffer_theme')||'system';var d=m==='dark'||(m!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.dataset.themeMode=m;var c=localStorage.getItem('gaffer_club');if(c&&/^[1-9]|^1[0-9]$|^20$/.test(c))r.dataset.club=c;}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontClassName} suppressHydrationWarning>
      <head>
        {/* Player faces and club crests are the heaviest third-party images on
            every screen — warm the connection while the document parses. */}
        <link rel="preconnect" href="https://resources.premierleague.com" />
        <link rel="dns-prefetch" href="https://resources.premierleague.com" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
