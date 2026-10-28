import type { Metadata } from "next";
import "@fontsource-variable/rubik";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raye on the Road",
  description: "Your people. Your next city.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
