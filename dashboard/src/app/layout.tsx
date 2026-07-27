import type { Metadata, Viewport } from "next";
import { Archivo, Azeret_Mono, DM_Sans, Space_Grotesk } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { RiLoader4Line } from "react-icons/ri";
import { AppShell } from "@/components/AppShell";
import { ThemeProvider, THEME_STYLE_ID } from "@/lib/theme/provider";
import { MotionRuntime } from "@/lib/theme/motion";
import { loadTheme } from "@/lib/theme/server";
import { themeToAttributes, themeToCss } from "@/lib/theme/tokens";
import "./globals.css";
import "./enhancements.css";

/*
 * Every family the theme can select is loaded here rather than fetched when it
 * is chosen. Swapping a font at runtime would otherwise mean a request, a
 * repaint and a reflow in the middle of the interface, which is the visible
 * flicker this design exists to avoid.
 */
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--font-space-grotesk" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--font-dm-sans" });
const archivo = Archivo({ subsets: ["latin"], display: "swap", variable: "--font-archivo" });
const azeretMono = Azeret_Mono({ subsets: ["latin"], display: "swap", variable: "--font-azeret-mono" });

export const metadata: Metadata = {
  title: "YEAN Leads, approval dashboard",
  description: "Semi-automated lead generation for YEAN Technologies",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/** The theme is read per request, so an edit is live on the next navigation. */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await loadTheme();
  const fonts = [spaceGrotesk, dmSans, archivo, azeretMono].map((f) => f.variable).join(" ");

  /*
   * The theme is resolved on the server and written into the markup, so the
   * first frame the browser paints is already the right one. There is no boot
   * script reading storage, no effect correcting colours after hydration, and
   * so no flash of the wrong interface.
   *
   * Dark mode is decided here too when the mode is explicit. Only "system"
   * needs the inline script below, because the server cannot know what the
   * viewer's operating system prefers; that script runs before the first paint,
   * so it is still flash free.
   */
  const attributes = themeToAttributes(theme);
  const explicitDark = theme.mode === "dark";

  return (
    <html
      lang="en"
      className={`${fonts}${explicitDark ? " dark" : ""}`}
      style={{ colorScheme: explicitDark ? "dark" : "light" }}
      suppressHydrationWarning
      {...attributes}
    >
      <head>
        <style id={THEME_STYLE_ID} dangerouslySetInnerHTML={{ __html: themeToCss(theme) }} />
        {theme.mode === "system" && (
          <script
            dangerouslySetInnerHTML={{
              __html:
                "try{if(matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark'}}catch(e){}",
            }}
          />
        )}
      </head>
      <body>
        <ThemeProvider initial={theme}>
          <AppShell>{children}</AppShell>
          <MotionRuntime />
          <Toaster
            position="top-right"
            toastOptions={{
              className: "!border !border-line !bg-surface !text-ink",
              loading: {
                icon: <RiLoader4Line className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />,
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
