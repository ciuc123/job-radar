import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Radar",
  description: "Your personal remote developer job radar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ClerkProvider><html lang="en"><body>
    <div className="auth-banner">Want to keep your progress? <Link href="/signin">Sign in</Link> to save jobs, notes and settings.</div>
    {children}
  </body></html></ClerkProvider>;
}
