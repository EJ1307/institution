"use client";

import { Check, CheckCircle2, Paperclip, PartyPopper } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { cn } from "@/components/ui/primitives";
import { addDays, today } from "@/lib/data/calendar";
import { classLabel } from "@/lib/data/school";
import { fmtWeekday, plural } from "@/lib/format";
import { useChild } from "@/lib/session";
import { getState, setState, useAppState } from "@/lib/store";
import { childHomework, daysUntil, dueLabel, statusFor, type HwItem } from "./model";

type Group = "overdue" | "today" | "week" | "later" | "done";

const GROUP_TITLE: Record<Group, string> = {
  overdue: "Overdue",
  today: "Due today",
  week: "This week",
  later: "Later",
  done: "Done",
};

export function ParentHomework() {
  const { child } = useChild();
  const toast = useToast();
  const doneMap = useAppState((s) => s.homeworkDone);
  const posted = useAppState((s) => s.homework);
  const [subject, setSubject] = useState("all");
  const [showAllDone, setShowAllDone] = useState(false);

  const t = today();
  const weekEnd = addDays(t, 7 - (t.getDay() === 0 ? 7 : t.getDay()));
  const items = useMemo(() => childHomework(child), [child, posted]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Ticked by the parent, or recorded as handed in by the teacher once the due date has passed. */
  const doneState = (h: HwItem): { done: boolean; how: "parent" | "teacher" | null } => {
    if (doneMap[h.id] !== undefined) return { done: doneMap[h.id], how: doneMap[h.id] ? "parent" : null };
    if (daysUntil(h.dueOn, t) < 0 && statusFor(h, child, t).status !== "pending") return { done: true, how: "teacher" };
    return { done: false, how: null };
  };

  const groupOf = (h: HwItem): Group => {
    if (doneState(h).done) return "done";
    const d = daysUntil(h.dueOn, t);
    if (d < 0) return "overdue";
    if (d === 0) return "today";
    if (h.dueOn <= weekEnd) return "week";
    return "later";
  };

  const subjects = [...new Set(items.map((h) => h.subject))].sort();
  const visible = items.filter((h) => subject === "all" || h.subject === subject);
  const grouped: Record<Group, HwItem[]> = { overdue: [], today: [], week: [], later: [], done: [] };
  for (const h of visible) grouped[groupOf(h)].push(h);
  // open work: soonest first; done: most recent first
  (["overdue", "today", "week", "later"] as Group[]).forEach((g) => grouped[g].sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime()));
  grouped.done.sort((a, b) => b.dueOn.getTime() - a.dueOn.getTime());

  const openCount = (s: string) => items.filter((h) => (s === "all" || h.subject === s) && groupOf(h) !== "done").length;
  const openTotal = grouped.overdue.length + grouped.today.length + grouped.week.length + grouped.later.length;

  const toggle = (h: HwItem) => {
    const now = !doneState(h).done;
    setState({ homeworkDone: { ...getState().homeworkDone, [h.id]: now } });
    toast(now ? { title: "Marked as done", body: `${h.subject}: ${h.title}. ${child.firstName}'s teacher still checks the notebook in class.` } : { title: "Moved back to to-do", body: h.title, tone: "info" });
  };

  const summary =
    openTotal === 0
      ? `${child.firstName} is all caught up.`
      : [grouped.today.length && `${grouped.today.length} due today`, grouped.week.length && `${grouped.week.length} more this week`, grouped.overdue.length && `${grouped.overdue.length} overdue`].filter(Boolean).join(" · ") || `${plural(openTotal, "assignment")} coming up`;

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader eyebrow={`${child.name} · Class ${classLabel(child.grade, child.section)}`} title="Homework" description={summary} className="mb-4" />

      <div role="radiogroup" aria-label="Filter by subject" className="scroll-thin -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {["all", ...subjects].map((s) => {
          const active = subject === s;
          const n = openCount(s);
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSubject(s)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                active ? "border-ink bg-ink text-white" : "border-line-strong/80 bg-surface text-ink-2 hover:border-line-strong",
              )}
            >
              {s === "all" ? "All subjects" : s}
              {n > 0 && <span className={cn("tnum rounded-full px-1.5 text-[11px] leading-[18px]", active ? "bg-white/20 text-white" : "bg-brand-soft text-brand")}>{n}</span>}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-surface">
          <EmptyState icon={<CheckCircle2 />} title={`No ${subject === "all" ? "" : subject + " "}homework in the last two weeks`} body={`When ${child.firstName}'s teachers set homework, it shows up here the same afternoon.`} />
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          {openTotal === 0 && (
            <div className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-good-soft text-good">
                <PartyPopper className="size-5" />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-ink">Nothing left to do{subject !== "all" ? ` in ${subject}` : ""}</p>
                <p className="text-[12.5px] text-muted">New homework usually arrives by 4:00 pm on school days.</p>
              </div>
            </div>
          )}
          {(["overdue", "today", "week", "later", "done"] as Group[]).map((g) => {
            const list = g === "done" && !showAllDone ? grouped.done.slice(0, 4) : grouped[g];
            if (!grouped[g].length) return null;
            return (
              <section key={g} aria-label={GROUP_TITLE[g]}>
                <h2 className="mb-2.5 flex items-baseline gap-2 text-[13px] font-semibold text-ink">
                  {GROUP_TITLE[g]}
                  <span className={cn("tnum text-[12px] font-medium", g === "overdue" ? "text-bad" : "text-muted")}>{grouped[g].length}</span>
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {list.map((h) => (
                    <HomeworkCard key={h.id} h={h} group={g} how={doneState(h).how} onToggle={() => toggle(h)} />
                  ))}
                </ul>
                {g === "done" && grouped.done.length > 4 && (
                  <button type="button" onClick={() => setShowAllDone((v) => !v)} className="mt-2.5 text-[13px] font-medium text-brand hover:underline">
                    {showAllDone ? "Show fewer" : `Show all ${grouped.done.length} done`}
                  </button>
                )}
              </section>
            );
          })}
          <p className="pb-2 text-center text-[12px] text-faint">Homework from the last two weeks. Older work is in {child.firstName}&apos;s notebooks.</p>
        </div>
      )}
    </div>
  );
}

function HomeworkCard({ h, group, how, onToggle }: { h: HwItem; group: Group; how: "parent" | "teacher" | null; onToggle: () => void }) {
  const done = group === "done";
  const label = dueLabel(h.dueOn);
  return (
    <li className={cn("flex gap-3 rounded-[14px] border bg-surface px-4 py-3.5 shadow-[var(--shadow-card)]", group === "overdue" ? "border-[color-mix(in_oklab,var(--bad)_25%,var(--line))]" : "border-line")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={onToggle}
        aria-label={done ? `Mark "${h.title}" as not done` : `Mark "${h.title}" as done`}
        className={cn(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
          done ? "border-brand bg-brand text-white" : "border-line-strong text-transparent hover:border-brand hover:text-brand/40",
        )}
      >
        <Check className="size-4" strokeWidth={2.6} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
          <span className="font-semibold text-ink-2">{h.subject}</span>
          <span className="text-faint">·</span>
          <span className="truncate text-muted">{h.by}</span>
        </div>
        <p className={cn("mt-1 text-[15px] leading-snug font-semibold", done ? "text-muted" : "text-ink")}>{h.title}</p>
        {!done && <p className="mt-1 text-[13.5px] leading-[20px] text-ink-2">{h.detail}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
          {done ? (
            <span className="inline-flex items-center gap-1 font-medium text-good">
              <CheckCircle2 className="size-3.5" /> {how === "teacher" ? `Handed in · was due ${fmtWeekday(h.dueOn)}` : "Done · ticked by you"}
            </span>
          ) : (
            <span className={cn("font-medium", group === "overdue" ? "text-bad" : group === "today" ? "text-warn" : "text-ink-2")}>{label}</span>
          )}
          {!done && <span className="text-muted">Set {fmtWeekday(h.assignedOn)}</span>}
          {h.attachment && (
            <span className="inline-flex items-center gap-1 text-muted">
              <Paperclip className="size-3.5" /> {h.attachment}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
