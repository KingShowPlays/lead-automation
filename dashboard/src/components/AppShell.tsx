"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { OnboardingGate } from "@/components/OnboardingGate";
import { PageTransition } from "@/lib/theme/motion";

/**
 * The application chrome, and the decision about when there should not be any.
 *
 * Sign-in sits outside the workspace: rendering the navigation around it shows
 * a signed-out visitor the shape of the system, and the approval count next to
 * it. The onboarding gate is skipped there too, since it calls an API that will
 * refuse an unauthenticated request and send the page straight back here.
 */
const BARE_ROUTES = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return <div className="app-shell">{children}</div>;
  }

  return (
    <OnboardingGate>
      <div className="app-shell flex">
        <Sidebar />
        <main className="app-main min-w-0 flex-1 overflow-x-hidden pb-16 pt-20 lg:pt-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </OnboardingGate>
  );
}
