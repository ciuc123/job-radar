import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Radar",
  description: "Your personal remote developer job radar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
