import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import "./header.css";
import AuthBanner from "@/components/auth-banner";

export const metadata: Metadata = {
  title: "Job Radar",
  description: "Your personal remote developer job radar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ClerkProvider><html lang="en"><body>
    <AuthBanner />
    {children}
    <Analytics />
    <SpeedInsights />
  </body></html></ClerkProvider>;
}
