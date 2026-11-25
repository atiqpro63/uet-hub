import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UET Hub | Department Academic Portal",
  description: "Classes, attendance, and department updates in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
