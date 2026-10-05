"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { allowed, PARENT_TABS } from "@/lib/nav";
import { useRole, useSession } from "@/lib/session";
import { cn } from "@/components/ui/primitives";
import { ToastProvider } from "@/components/ui/overlay";
import { CommandPalette } from "./CommandPalette";
import { Crest } from "./Crest";
import { Sidebar, SidebarContent } from "./Sidebar";
import { Topbar } from "./Topbar";

/** Client-only app frame: auth gate, sidebar, top bar, ⌘K, mobile nav. */
export function AppShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const session = useSession();
  const role = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !session) router.replace("/login");
  }, [mounted, session, router]);

  useEffect(() => {
    if (mounted && session && !allowed(role, pathname)) router.replace("/dashboard");
  }, [mounted, session, role, pathname, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setDrawer(false), [pathname]);

  if (!mounted || !session) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper">
        <Crest size={44} className="animate-pulse" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <Sidebar />
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
      <div className="lg:pl-[248px]">
        <Topbar onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
        <main id="main" className={cn("mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8", role === "parent" && "pb-28 lg:pb-8")}>
          <div key={`${role}-${pathname}`} className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
      {role === "parent" && <ParentTabs />}
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </ToastProvider>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="animate-fade-in absolute inset-0 bg-[rgb(18_20_22/0.45)]" onClick={onClose} />
      <div className="animate-sheet-in absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-2xl">
        <SidebarContent onNavigate={onClose} />
      </div>
    </div>
  );
}

function ParentTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Quick" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {PARENT_TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cn("flex h-[60px] flex-col items-center justify-center gap-1 text-[10.5px] font-medium", active ? "text-brand" : "text-muted")}>
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
