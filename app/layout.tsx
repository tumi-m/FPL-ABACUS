import type { Metadata, Viewport } from "next";
import { brand } from "@/config/brand";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* FLOODLIGHT rev-02 type system: Saira carries every figure (italic, width axis),
            Barlow carries everything you read. See architecture/GAFFER_STYLE_GUIDE.md §5. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Saira:ital,wdth,wght@0,75..125,300..900;1,75..125,400..900&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,600&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
