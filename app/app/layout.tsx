import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UET FSD - Data Science Hub",
  description: "Routine, labs, bus routes, and batch ledger",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50">{children}</body>
    </html>
  );
}
