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
  // Server-side session fetch so the sidebar can reflect auth state immediately
  const session = await getServerSession(authOptions);
  const role =
    (session as any)?.role ??
    (session as any)?.user?.role ??
    undefined;

  return (
    <html lang="en">
      <body className="min-h-screen">
        <SessionProvider>
          <div className="flex min-h-screen">
            <aside className="w-64 border-r border-slate-800 p-4 bg-slate-950">
              <h1 className="text-xl font-semibold mb-6">Control Plane</h1>

              <nav className="space-y-2 text-sm">
                <Link href="/" className="block hover:text-white">
                  Overview
                </Link>
                <Link href="/orgs" className="block hover:text-white">
                  Orgs
                </Link>
                <Link href="/usage" className="block hover:text-white">
                  Usage
                </Link>
                <Link href="/support" className="block hover:text-white">
                  Support
                </Link>
                <Link href="/settings" className="block hover:text-white">
                  Settings
                </Link>

                {!session ? (
                  <Link href="/login" className="block mt-6 text-emerald-400">
                    Sign in
                  </Link>
                ) : (
                  <div className="mt-6 space-y-2">
                    <form action="/api/auth/signout" method="post">
                      <button className="text-rose-400 hover:text-rose-300" type="submit">
                        Sign out
                      </button>
                    </form>
                    <div className="text-xs text-slate-400">
                      {session.user?.email}
                      {role ? (
                        <>
                          {" "}
                          • <span className="uppercase">{String(role)}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}
              </nav>
            </aside>

            <main className="flex-1 p-6 bg-slate-950">{children}</main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
