import type { Metadata, Viewport } from "next";
import { brand } from "@/config/brand";
import { fontClassName } from "@/config/fonts";
import { Providers } from "@/components/primitives/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
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
