import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Control Plane",
  description: "Kernel for usage-based SaaS/API control"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <aside className="w-64 border-r border-slate-800 p-4 bg-slate-950">
            <h1 className="text-xl font-semibold mb-6">Control Plane</h1>
            <nav className="space-y-2 text-sm">
              <a href="/" className="block hover:text-white">
                Overview
              </a>
              <a href="/orgs" className="block hover:text-white">
                Orgs
              </a>
              <a href="/usage" className="block hover:text-white">
                Usage
              </a>
              <a href="/support" className="block hover:text-white">
                Support
              </a>
              <a href="/settings" className="block hover:text-white">
                Settings
              </a>
            </nav>
          </aside>
          <main className="flex-1 p-6 bg-slate-950">{children}</main>
        </div>
      </body>
    </html>
  );
}
