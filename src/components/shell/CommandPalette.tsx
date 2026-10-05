"use client";

import { ArrowRight, CornerDownLeft, GraduationCap, Search, UsersRound, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { students, staff } from "@/lib/data/people";
import { classLabel } from "@/lib/data/school";
import { NAV, SETTINGS_ITEM } from "@/lib/nav";
import { useRole } from "@/lib/session";
import { Avatar, cn, Kbd } from "@/components/ui/primitives";

type Result = { id: string; group: string; label: string; sub?: string; href: string; icon: React.ReactNode };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const role = useRole();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setQ("");
      setActive(0);
    }
    if (!open && d.open) d.close();
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    const pages = [...NAV[role].flatMap((g) => g.items), ...(role === "admin" ? [SETTINGS_ITEM] : [])].map((i) => ({
      id: `p-${i.href}`,
      group: "Go to",
      label: i.label,
      href: i.href,
      icon: <i.icon className="size-4" />,
    }));
    const actions: Result[] =
      role === "admin"
        ? [
            { id: "a-notice", group: "Actions", label: "Post a notice", href: "/notices?compose=1", icon: <Zap className="size-4" /> },
            { id: "a-defaulters", group: "Actions", label: "Send fee reminders to overdue families", href: "/fees?tab=overdue", icon: <Zap className="size-4" /> },
            { id: "a-admission", group: "Actions", label: "Review new admission enquiries", href: "/admissions", icon: <Zap className="size-4" /> },
          ]
        : role === "teacher"
          ? [
              { id: "a-reg", group: "Actions", label: "Mark attendance for VIII-B", href: "/attendance", icon: <Zap className="size-4" /> },
              { id: "a-hw", group: "Actions", label: "Set homework", href: "/homework?new=1", icon: <Zap className="size-4" /> },
            ]
          : [{ id: "a-pay", group: "Actions", label: "Pay school fees", href: "/fees", icon: <Zap className="size-4" /> }];

    if (!term) return [...actions, ...pages];

    const match = (s: string) => s.toLowerCase().includes(term);
    const out: Result[] = [...actions, ...pages].filter((r) => match(r.label));
    if (role !== "parent") {
      const kids = students()
        .filter((s) => match(s.name) || match(s.admissionNo) || match(classLabel(s.grade, s.section)))
        .slice(0, 6)
        .map((s) => ({
          id: s.id,
          group: "Students",
          label: s.name,
          sub: `${classLabel(s.grade, s.section)} · ${s.admissionNo}`,
          href: `/students/${s.id}`,
          icon: <Avatar name={s.name} size={22} />,
        }));
      out.push(...kids);
    }
    if (role === "admin") {
      const people = staff()
        .filter((s) => match(s.name) || match(s.designation))
        .slice(0, 4)
        .map((s) => ({ id: s.id, group: "Staff", label: `${s.title} ${s.name}`, sub: s.designation, href: `/staff?id=${s.id}`, icon: <Avatar name={s.name} size={22} /> }));
      out.push(...people);
    }
    return out;
  }, [q, role]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    router.push(r.href);
  };

  let lastGroup = "";

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="mx-auto mt-[12vh] w-[calc(100vw-24px)] max-w-[600px] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-[rgb(18_20_22/0.38)] open:animate-pop-in"
    >
      {open && (
        <div
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(results[active]);
            }
          }}
        >
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-[18px] text-muted" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={role === "parent" ? "Search pages and actions…" : "Search students, staff, pages…"}
              aria-label="Search"
              className="h-14 flex-1 bg-transparent text-[15px] placeholder:text-faint focus:outline-none"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div ref={list} className="scroll-thin max-h-[min(420px,60vh)] overflow-y-auto p-2" role="listbox">
            {results.length === 0 && <p className="px-3 py-10 text-center text-[13px] text-muted">Nothing matches “{q}”.</p>}
            {results.map((r, i) => {
              const header = r.group !== lastGroup ? r.group : null;
              lastGroup = r.group;
              return (
                <div key={r.id}>
                  {header && (
                    <div className="flex items-center gap-2 px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
                      {header === "Students" ? <GraduationCap className="size-3.5" /> : header === "Staff" ? <UsersRound className="size-3.5" /> : null}
                      {header}
                    </div>
                  )}
                  <button
                    type="button"
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(r)}
                    className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px]", i === active ? "bg-brand-soft text-ink" : "text-ink-2")}
                  >
                    <span className={cn("grid size-6 place-items-center", i === active ? "text-brand" : "text-muted")}>{r.icon}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {r.label}
                      {r.sub && <span className="ml-2 text-[12px] text-muted">{r.sub}</span>}
                    </span>
                    {i === active ? <CornerDownLeft className="size-3.5 text-muted" /> : <ArrowRight className="size-3.5 text-transparent" />}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 border-t border-line bg-surface-2 px-4 py-2.5 text-[11.5px] text-muted">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd> to open
            </span>
          </div>
        </div>
      )}
    </dialog>
  );
}
