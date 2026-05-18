import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { PwaRegistrar } from "@/components/PwaRegistrar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Trickee | EV Intelligence Platform",
  description: "EV fleet intelligence and predictive range analytics.",
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
};

export const viewport: Viewport = {
  themeColor: "#07090d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>
          <PwaRegistrar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
