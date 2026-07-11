import type { Metadata } from "next";
import "./globals.css";

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
