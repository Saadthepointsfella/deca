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
  // SSR session so the sidebar reflects auth immediately
  const session = await getServerSession(authOptions);
  const role =
    (session as any)?.role ??
    (session as any)?.user?.role ??
    undefined;

  const isAdmin =
    role === "OWNER" ||
    role === "ADMIN";

  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return (
    <html lang="en">
      <body className="min-h-screen">
        <SessionProvider>
          {/* Demo mode banner */}
          {isDemo && (
            <div className="w-full bg-ink-900 border-b border-ink-700 text-2xs text-ink-300 px-3 py-1 flex justify-between">
              <span>Demo mode — seeded plans, orgs, usage, and tickets.</span>
              <span className="font-mono text-ink-500">DEMO</span>
            </div>
          )}

          {/* Compact monochrome grid layout */}
          <div className="min-h-screen grid grid-cols-[220px_1fr]">
            <aside className="border-r border-ink-800 bg-ink-950">
              <div className="px-4 py-4">
                <h1 className="text-base font-semibold tracking-wide">Control Plane</h1>
                <div className="text-xs text-ink-400 mt-1">Monochrome</div>
              </div>

              <nav className="px-2 py-2 text-sm">
                <Link className="block px-2 py-1 rounded hover:bg-ink-900" href="/">
                  Overview
                </Link>
                <Link className="block px-2 py-1 rounded hover:bg-ink-900" href="/orgs">
                  Orgs
                </Link>
                <Link className="block px-2 py-1 rounded hover:bg-ink-900" href="/usage">
                  Usage
                </Link>
                <Link className="block px-2 py-1 rounded hover:bg-ink-900" href="/support">
                  Support
                </Link>
                <Link className="block px-2 py-1 rounded hover:bg-ink-900" href="/settings">
                  Settings
                </Link>
                <Link className="block px-2 py-1 rounded hover:bg-ink-900" href="/docs">
                  Docs
                </Link>

                {isAdmin && (
                  <Link className="block px-2 py-1 rounded hover:bg-ink-900" href="/admin">
                    Admin
                  </Link>
                )}
              </nav>

              <div className="px-4 py-4 border-t border-ink-800 text-xs text-ink-400">
                {!session ? (
                  <Link href="/login" className="underline">
                    Sign in
                  </Link>
                ) : (
                  <>
                    <div className="truncate">{session.user?.email}</div>
                    {role && (
                      <div className="mt-0.5">
                        role:{" "}
                        <span className="text-ink-300">
                          {String(role).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <form action="/api/auth/signout" method="post" className="mt-2">
                      <button className="underline">Sign out</button>
                    </form>
                  </>
                )}
              </div>
            </aside>

            <main className="p-6 bg-ink-950 text-ink-100">{children}</main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
