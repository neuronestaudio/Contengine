import type { Metadata } from "next";
import "./globals.css";

// Run server components in Sydney, next to the Supabase database (also Sydney).
// Without this, functions default to iad1 (US) and every DB query round-trips
// the Pacific twice — 1-2.5s per query. Co-located it is ~50ms.
export const preferredRegion = "syd1";

export const metadata: Metadata = {
  title: "Contengine",
  description: "Multi-client social media scheduling",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
