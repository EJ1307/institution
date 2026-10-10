"use client";

import { Badge, cn } from "@/components/ui/primitives";
import type { FeeAccount } from "@/lib/data/fees";
import type { Student } from "@/lib/data/people";
import { HOUSES } from "@/lib/data/school";
import { dollars } from "@/lib/format";

export type FeeState = "clear" | "due" | "overdue";

export function feeState(acc: FeeAccount): FeeState {
  if (acc.overdue > 0) return "overdue";
  if (acc.outstanding > 0) return "due";
  return "clear";
}

export const FEE_STATE_LABEL: Record<FeeState, string> = { clear: "Clear", due: "Due", overdue: "Overdue" };

export function FeeBadge({ acc, compact }: { acc: FeeAccount; compact?: boolean }) {
  const st = feeState(acc);
  if (st === "clear")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
        <span className="size-1.5 rounded-full bg-good" aria-hidden />
        Clear
      </span>
    );
  return (
    <Badge tone={st === "overdue" ? "bad" : "warn"} className="tnum">
      {st === "overdue" ? "Overdue" : "Due"}
      {!compact && <span className="font-semibold">{dollars(st === "overdue" ? acc.overdue : acc.outstanding)}</span>}
    </Badge>
  );
}

export function houseColor(id: string) {
  return HOUSES.find((h) => h.id === id)?.color ?? "var(--faint)";
}

export function HouseTag({ house, className }: { house: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12.5px] text-ink-2", className)}>
      <span className="size-2 rounded-full" style={{ background: houseColor(house) }} aria-hidden />
      {house}
    </span>
  );
}

export function primaryGuardian(s: Student) {
  return s.guardians[0];
}

/** Ages like "13 y 4 m" on a reference date. */
export function ageOn(dob: Date, on: Date) {
  let months = (on.getFullYear() - dob.getFullYear()) * 12 + on.getMonth() - dob.getMonth();
  if (on.getDate() < dob.getDate()) months--;
  return { years: Math.floor(months / 12), months: months % 12 };
}

export function fmtAge(dob: Date, on: Date) {
  const a = ageOn(dob, on);
  return `${a.years} y ${a.months} m`;
}

// ——— CSV ——————————————————————————————————————————————————————————

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, header: string[], rows: (string | number | null)[][]) {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  // BOM so spreadsheet apps read names correctly
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Summary strip: hairline-separated cells inside one card. */
export function SummaryStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line shadow-[var(--shadow-card)]", className)}>
      {children}
    </div>
  );
}

export function SummaryCell({ label, value, sub, className }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 bg-surface px-4 py-3.5", className)}>
      <div className="truncate text-[12px] font-medium text-muted">{label}</div>
      <div className="tnum mt-1 text-[20px] leading-tight font-semibold tracking-[-0.01em] text-ink">{value}</div>
      {sub && <div className="mt-1 text-[12px] leading-snug text-muted">{sub}</div>}
    </div>
  );
}
