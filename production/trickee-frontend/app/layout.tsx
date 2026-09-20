import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { PwaRegistrar } from "@/components/PwaRegistrar";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme-runtime.mjs";

const manrope = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-manrope",
  weight: "100 900",
});

const syne = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-syne",
  weight: "100 900",
});

const michroma = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-michroma",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://trickee.co.in"),
  title: {
    default: "Trickee | Your Car Already Knows the Way",
    template: "%s | Trickee",
  },
  description: "Trickee turns raw GPS movement into protected range, safer routing, and decisions your EV fleet can trust.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Trickee",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#03070b" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning className={`${manrope.variable} ${syne.variable} ${michroma.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>
          <PwaRegistrar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
