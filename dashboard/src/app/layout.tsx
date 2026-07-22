import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "YEAN Leads — Approval Dashboard",
  description: "Semi-automated lead generation for YEAN Technologies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${dmSans.variable}`}>
      <body>
        <div className="relative min-h-screen">
          {/* Ambient gradient background */}
          <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
            <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-cta-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
          </div>

          <div className="flex">
            <Sidebar />
            <main className="min-h-screen flex-1 px-4 pb-16 pt-6 sm:px-8 lg:px-10">{children}</main>
          </div>
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            className: "!rounded-xl !bg-slate-900 !text-white dark:!bg-white dark:!text-slate-900",
          }}
        />
      </body>
    </html>
  );
}
