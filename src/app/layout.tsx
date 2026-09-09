import React from "react";
import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";
import NativeBackHandler from "@/components/NativeBackHandler";
import { SuggestionProvider } from "@/components/ui/HorizontalSuggestions";
import "../styles/tailwind.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2563EB",
};

export const metadata: Metadata = {
  title: "SI WorkLog — Interior Painting Job Management",
  description:
    "Offline-capable PWA for painting supervisors to record measurements, manage jobs, and generate A4 printouts that match Standard Interior paper forms.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "32x32" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SI WorkLog",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${ibmPlexMono.variable}`}>
      <body className={dmSans.className}>
        <PwaRegister />
        <NativeBackHandler />
        <SuggestionProvider>{children}</SuggestionProvider>
      </body>
    </html>
  );
}
