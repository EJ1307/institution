"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui/primitives";

export type HeatCell = { key: string; value: number | null; display: string; detail?: ReactNode; href?: string } | null;

/** Attendance vs target, binned into labelled status steps (the number is always printed in the cell). */
export const ATTENDANCE_BINS = [
  { min: 0.95, label: "95%+", bg: "#D9ECE1", fg: "#1D5A40" },
  { min: 0.9, label: "90–95%", bg: "#F1F0EB", fg: "#3F4348" },
  { min: 0.85, label: "85–90%", bg: "#F8E6C2", fg: "#7A4D06" },
  { min: 0, label: "Below 85%", bg: "#F2C9BC", fg: "#7E2A17" },
];

export function attendanceTone(v: number) {
  return ATTENDANCE_BINS.find((b) => v >= b.min)!;
}

export function Heatmap({
  rows,
  columns,
  tone,
  onCell,
  rowLabelWidth = 64,
}: {
  rows: { label: string; cells: HeatCell[] }[];
  columns: string[];
  tone: (v: number) => { bg: string; fg: string };
  onCell?: (key: string) => void;
  rowLabelWidth?: number;
}) {
  const [tip, setTip] = useState<{ key: string; x: number; y: number; body: ReactNode } | null>(null);
  return (
    <div className="relative">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `${rowLabelWidth}px repeat(${columns.length}, minmax(0, 1fr))` }}>
        <div />
        {columns.map((c) => (
          <div key={c} className="pb-1 text-center text-[11px] font-medium text-muted">
            {c}
          </div>
        ))}
        {rows.map((r) => (
          <Row key={r.label} row={r} tone={tone} onCell={onCell} setTip={setTip} />
        ))}
      </div>
      {tip && (
        <div className="viz-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.body}
        </div>
      )}
    </div>
  );
}

function Row({
  row,
  tone,
  onCell,
  setTip,
}: {
  row: { label: string; cells: HeatCell[] };
  tone: (v: number) => { bg: string; fg: string };
  onCell?: (key: string) => void;
  setTip: (t: { key: string; x: number; y: number; body: ReactNode } | null) => void;
}) {
  return (
    <>
      <div className="flex items-center text-[12px] font-medium text-ink-2">{row.label}</div>
      {row.cells.map((c, i) => {
        if (!c) return <div key={i} className="h-8 rounded-[5px]" />;
        const unmarked = c.value === null;
        const t = unmarked ? null : tone(c.value!);
        const show = (el: HTMLElement) => {
          const parent = el.offsetParent as HTMLElement;
          const r = el.getBoundingClientRect();
          const pr = parent.getBoundingClientRect();
          setTip({ key: c.key, x: r.left - pr.left + r.width / 2, y: r.top - pr.top, body: c.detail ?? c.display });
        };
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onCell?.(c.key)}
            onPointerEnter={(e) => show(e.currentTarget)}
            onPointerLeave={() => setTip(null)}
            onFocus={(e) => show(e.currentTarget)}
            onBlur={() => setTip(null)}
            aria-label={`${row.label} ${c.key}: ${c.display}`}
            className={cn(
              "tnum h-8 rounded-[5px] text-[11.5px] font-semibold transition-[filter,box-shadow] hover:brightness-[0.96] hover:shadow-[inset_0_0_0_1.5px_rgb(0_0_0/0.18)]",
              unmarked && "border border-dashed border-line-strong bg-surface text-muted",
            )}
            style={t ? { background: t.bg, color: t.fg } : undefined}
          >
            {c.display}
          </button>
        );
      })}
    </>
  );
}
