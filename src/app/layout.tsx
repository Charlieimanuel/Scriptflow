import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ScriptFlow AI — Script Breakdown & Anggaran Produksi Real-Time",
    template: "%s · ScriptFlow AI",
  },
  description:
    "Unggah naskah, AI memecah adegan dan mengekstrak pemeran, properti, kostum, lokasi, serta pencahayaan — anggaran dan jadwal syuting ter-update real-time setiap kali naskah direvisi.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="grain min-h-full flex flex-col">{children}</body>
    </html>
  );
}
