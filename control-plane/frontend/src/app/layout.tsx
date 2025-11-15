import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../lib/auth";
import { SessionProvider } from "../components/SessionProvider";

export const metadata = {
  title: "Control Plane",
  description: "Kernel for usage-based SaaS/API control",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // SSR session so the chrome reflects auth immediately
  const session = await getServerSession(authOptions);
  const role =
    (session as any)?.role ??
    (session as any)?.user?.role ??
    undefined;

  const isAdmin = role === "OWNER" || role === "ADMIN";
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return (
    <html lang="en">
      <body className="bg-ink-950 text-ink-50 antialiased min-h-screen">
        <SessionProvider>
          {/* Demo mode banner */}
          {isDemo && (
            <div className="w-full bg-ink-900 border-b border-ink-700 text-[11px] text-ink-300 px-4 py-1.5 flex justify-between">
              <span>Demo mode — seeded plans, orgs, usage, and tickets.</span>
              <span className="font-mono text-ink-500">DEMO</span>
            </div>
          )}

          <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside className="hidden md:flex w-56 flex-col border-r border-ink-800 bg-ink-950">
              <div className="px-4 py-4 border-b border-ink-800">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-500">
                  Control Plane
                </div>
                <div className="mt-1 text-sm font-semibold text-ink-50">
                  Kernel Console
                </div>
                <div className="text-[11px] text-ink-500 mt-0.5">
                  Monochrome / serious
                </div>
              </div>

              <nav className="flex-1 px-3 py-3 text-xs space-y-0.5">
                <NavItem href="/" label="Overview" />
                <NavItem href="/orgs" label="Orgs" />
                <NavItem href="/usage" label="Usage" />
                <NavItem href="/support" label="Support" />
                <NavItem href="/settings" label="Settings" />
                <NavItem href="/docs" label="Docs" />
                {isAdmin && <NavItem href="/admin" label="Admin" />}
              </nav>

              <div className="px-4 py-3 border-t border-ink-800 text-[11px] text-ink-400 space-y-1.5">
                {!session ? (
                  <Link href="/login" className="underline">
                    Sign in
                  </Link>
                ) : (
                  <>
                    <div className="truncate text-ink-300">
                      {session.user?.email}
                    </div>
                    {role && (
                      <div className="flex items-center gap-1">
                        <span>role:</span>
                        <span className="px-1.5 py-0.5 rounded-full border border-ink-700 text-[10px] text-ink-100">
                          {String(role).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <form
                      action="/api/auth/signout"
                      method="post"
                      className="pt-1"
                    >
                      <button className="underline text-ink-500 hover:text-ink-200">
                        Sign out
                      </button>
                    </form>
                  </>
                )}
              </div>
            </aside>

            {/* Main column */}
            <div className="flex-1 flex flex-col">
              {/* Top bar */}
              <header className="h-11 flex items-center justify-between border-b border-ink-800 px-4 md:px-8 bg-ink-950/90 backdrop-blur">
                <div className="flex items-center gap-2 text-[11px] text-ink-500">
                  <span className="hidden sm:inline">Control Plane</span>
                  <span className="hidden sm:inline text-ink-700">/</span>
                  {/* Keep this generic; individual pages set their own H1 */}
                  <span className="font-medium text-ink-200">Kernel overview</span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  {session ? (
                    <span className="px-2 py-1 rounded-full border border-ink-700 text-ink-300">
                      Signed in
                    </span>
                  ) : (
                    <Link
                      href="/login"
                      className="px-2 py-1 rounded-full border border-ink-700 text-ink-300 hover:bg-ink-900/60"
                    >
                      Sign in
                    </Link>
                  )}
                </div>
              </header>

              {/* Page content */}
              <main className="flex-1 px-4 md:px-8 py-6">
                <div className="mx-auto w-full max-w-5xl space-y-6">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}

// Simple link with hover only (no active state, to keep it server-safe)
function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-2 py-1.5 rounded-md text-ink-500 hover:text-ink-100 hover:bg-ink-900/70 transition-colors"
    >
      {label}
    </Link>
  );
}
