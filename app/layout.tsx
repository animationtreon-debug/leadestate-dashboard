import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Centralized Client Dashboard",
  description: "Client success, payments, and pipeline overview",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f8f9fc]">{children}</body>
    </html>
  );
}
