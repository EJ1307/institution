"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui/primitives";
import { useMeasure } from "./useMeasure";

export const SERIES = {
  s1: "var(--series-1)",
  s2: "var(--series-2)",
  s3: "var(--series-3)",
  s4: "var(--series-4)",
  muted: "var(--series-muted)",
};

/** Legend: always present for ≥ 2 series. Rect keys for bars/areas, line keys for lines. */
export function Legend({ items, kind = "rect", className }: { items: { label: ReactNode; color: string; value?: ReactNode }[]; kind?: "rect" | "line"; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-2", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-1.5">
          {kind === "rect" ? (
            <span className="size-2.5 rounded-[3px]" style={{ background: it.color }} aria-hidden />
          ) : (
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: it.color }} aria-hidden />
          )}
          <span>{it.label}</span>
          {it.value !== undefined && <span className="tnum font-semibold text-ink">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Tiny trend line for stat tiles: de-emphasis hue with the latest point in the accent. */
export function Sparkline({ values, color = "var(--series-1)", height = 32, className }: { values: number[]; color?: string; height?: number; className?: string }) {
  const [ref, width] = useMeasure();
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = 4;
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo || 1)) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values.length - 1;
  return (
    <div ref={ref} className={cn("w-full", className)} style={{ height }} aria-hidden>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          <path d={`${d}L${x(last)},${height}L${x(0)},${height}Z`} fill={color} fillOpacity={0.08} />
          <path d={d} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last)} cy={y(values[last])} r={3} fill={color} stroke="var(--surface)" strokeWidth={1.5} />
        </svg>
      )}
    </div>
  );
}

/** Horizontal bars with the value at the tip — for ranked lists. */
export function BarList({
  rows,
  max,
  format = (n) => String(n),
  color = SERIES.s1,
  labelWidth = 120,
  thickness = 8,
  marker,
}: {
  rows: { id: string; label: ReactNode; value: number; sub?: ReactNode; color?: string; display?: ReactNode }[];
  max?: number;
  format?: (n: number) => string;
  color?: string;
  labelWidth?: number;
  thickness?: number;
  /** optional reference marker (e.g. a target) drawn on every track */
  marker?: { value: number; label: string };
}) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 0) * 1.05;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.id} className="grid items-center gap-x-3" style={{ gridTemplateColumns: `minmax(0, ${labelWidth}px) 1fr auto` }}>
          <div className="min-w-0 truncate text-[12.5px] text-ink-2">
            {r.label}
            {r.sub && <span className="ml-1.5 text-muted">{r.sub}</span>}
          </div>
          <div className="relative" style={{ height: thickness }}>
            <div className="absolute inset-0 rounded-full bg-ink/[0.045]" />
            <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(1, r.value / (top || 1))) * 100}%`, background: r.color ?? color }} />
            {marker && (
              <div className="absolute -inset-y-1 w-px bg-ink/45" style={{ left: `${(marker.value / (top || 1)) * 100}%` }} title={marker.label} />
            )}
          </div>
          <div className="tnum min-w-[44px] text-right text-[12.5px] font-semibold text-ink">{r.display ?? format(r.value)}</div>
        </li>
      ))}
    </ul>
  );
}

/** Part-to-whole as a single 100% bar with 2px surface gaps, plus a legend with values. */
export function StackedBar({
  segments,
  format = (n) => String(n),
  height = 12,
  columns = 2,
}: {
  segments: { label: string; value: number; color: string }[];
  format?: (n: number) => string;
  height?: number;
  /** legend columns from the sm breakpoint up */
  columns?: 1 | 2;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <div className="flex w-full gap-[2px] overflow-hidden rounded-full" style={{ height }} role="img" aria-label={segments.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(", ")}>
        {segments.map((s, i) => (
          <div
            key={s.label}
            className="h-full transition-opacity first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color, opacity: hover === null || hover === i ? 1 : 0.45 }}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          />
        ))}
      </div>
      <ul className={cn("mt-4 grid grid-cols-1 gap-x-6 gap-y-2", columns === 2 && "sm:grid-cols-2")}>
        {segments.map((s, i) => (
          <li
            key={s.label}
            className={cn("flex items-center gap-2 text-[12.5px] transition-opacity", hover !== null && hover !== i && "opacity-50")}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{s.label}</span>
            <span className="tnum font-semibold whitespace-nowrap text-ink">{format(s.value)}</span>
            <span className="tnum w-10 text-right text-muted">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Funnel: ordered stages on an ordinal ramp, with step conversion. */
export function Funnel({ stages, ramp = ["#86C2A4", "#5AA883", "#33906A", "#1F7653", "#145C40"] }: { stages: { label: string; count: number }[]; ramp?: string[] }) {
  const top = stages[0]?.count || 1;
  return (
    <ol className="flex flex-col gap-2">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].count : null;
        return (
          <li key={s.label} className="grid grid-cols-[96px_1fr_auto] items-center gap-3">
            <span className="truncate text-[12.5px] text-ink-2">{s.label}</span>
            <div className="h-6">
              <div className="h-full rounded-[4px] transition-[width] duration-500" style={{ width: `${Math.max(2, (s.count / top) * 100)}%`, background: ramp[Math.min(i, ramp.length - 1)] }} />
            </div>
            <span className="flex w-[84px] items-baseline justify-end gap-1.5">
              <span className="tnum text-[13px] font-semibold text-ink">{s.count}</span>
              {prev !== null && <span className="tnum text-[11px] text-muted">{Math.round((s.count / (prev || 1)) * 100)}%</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
