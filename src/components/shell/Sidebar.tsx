"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { academicYear } from "@/lib/data/calendar";
import { NAV, SETTINGS_ITEM, type NavItem } from "@/lib/nav";
import { useBrand, useRole } from "@/lib/session";
import { cn } from "@/components/ui/primitives";
import { Crest } from "./Crest";

function Item({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] transition-colors",
        active ? "bg-white/[0.11] font-medium text-white" : "text-white/[0.68] hover:bg-white/[0.06] hover:text-white",
      )}
    >
      {active && <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-accent" aria-hidden />}
      <Icon className={cn("size-[17px] shrink-0", active ? "text-accent" : "text-white/50 group-hover:text-white/80")} strokeWidth={1.9} />
      {item.label}
    </Link>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = useRole();
  const brand = useBrand();
  const ay = academicYear();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex h-full flex-col bg-brand-deep text-white">
      <div className="flex items-center gap-3 px-5 pt-5 pb-6">
        <Crest size={38} />
        <div className="min-w-0">
          <div className="title-serif truncate text-[15px] leading-tight font-semibold text-white">{brand.school.replace(/ (International School|Academy)$/, "")}</div>
          <div className="truncate text-[11.5px] text-white/50">{brand.school.match(/ (International School|Academy)$/)?.[1] ?? brand.city}</div>
        </div>
      </div>

      <nav aria-label="Main" className="scroll-thin flex-1 overflow-y-auto px-3 pb-4 [scrollbar-color:rgb(255_255_255/0.15)_transparent]">
        {NAV[role].map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-5")}>
            {group.label && <div className="mb-1.5 px-3 text-[10.5px] font-semibold tracking-[0.1em] text-white/[0.38] uppercase">{group.label}</div>}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <Item key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.08] px-3 py-3">
        {role === "admin" && <Item item={SETTINGS_ITEM} active={isActive(SETTINGS_ITEM.href)} onNavigate={onNavigate} />}
        <div className="mt-2 flex items-center justify-between px-3 text-[11.5px] text-white/[0.42]">
          <span>AY {ay.label}</span>
          <span>
            Powered by <span className="font-semibold text-white/60">{brand.product}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] lg:block">
      <SidebarContent />
    </aside>
  );
}
