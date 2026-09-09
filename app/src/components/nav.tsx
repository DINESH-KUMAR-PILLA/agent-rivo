"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/stores", label: "Stores" },
  { href: "/visits", label: "Visits" },
  { href: "/reports", label: "Reports" },
];

export function NavBar({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-lift">
            R
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-ink">Agent Rivo</div>
            <div className="text-[11px] text-ink-faint">Field visit reporting</div>
          </div>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(l.href) ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:bg-slate-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-medium text-ink-soft sm:inline">{displayName}</span>
          <button onClick={signOut} className="btn-ghost !py-1.5 !px-3 text-xs">
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
              isActive(l.href) ? "bg-brand-50 text-brand-700" : "text-ink-soft"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
