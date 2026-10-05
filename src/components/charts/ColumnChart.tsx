"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { niceMax, niceTicks, useMeasure } from "./useMeasure";

export type ColumnSeries = { id: string; label: string; color: string; values: number[] };

/** Rounded-top column path: 4px radius at the data end, square at the baseline. */
function columnPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/**
 * Grouped or stacked columns. Bars ≤ 24px, 2px surface gap between touching
 * marks, hover per category with every series in one tooltip.
 */
export function ColumnChart({
  categories,
  series,
  stacked = false,
  height = 220,
  yFormat = (n) => String(n),
  valueFormat,
  highlight,
  ariaLabel,
  maxBar = 24,
}: {
  categories: string[];
  series: ColumnSeries[];
  stacked?: boolean;
  height?: number;
  yFormat?: (n: number) => string;
  valueFormat?: (n: number) => string;
  /** index of a category to label on its cap (e.g. the current month) */
  highlight?: number;
  ariaLabel: string;
  maxBar?: number;
}) {
  const [ref, width] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);
  const fmtVal = valueFormat ?? yFormat;

  const max = useMemo(() => {
    const totals = categories.map((_, i) =>
      stacked ? series.reduce((a, s) => a + (s.values[i] ?? 0), 0) : Math.max(...series.map((s) => s.values[i] ?? 0)),
    );
    return niceMax(Math.max(...totals, 0));
  }, [categories, series, stacked]);
  const ticks = niceTicks(0, max, 4);

  const longest = Math.max(...ticks.map((t) => yFormat(t).length));
  const m = { top: highlight !== undefined ? 22 : 10, right: 4, bottom: 26, left: Math.max(28, longest * 6.6 + 10) };
  const w = Math.max(0, width - m.left - m.right);
  const h = height - m.top - m.bottom;
  const n = categories.length;
  const band = w / Math.max(1, n);
  const groups = stacked ? 1 : series.length;
  const gap = 2;
  const barW = Math.max(3, Math.min(maxBar, (band * 0.62 - gap * (groups - 1)) / groups));
  const groupW = barW * groups + gap * (groups - 1);
  const y = (v: number) => m.top + h - (v / max) * h;
  const labelEvery = band < 26 ? Math.ceil(26 / band) : 1;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setHover((v) => Math.min(n - 1, (v ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((v) => Math.max(0, (v ?? n) - 1));
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} tabIndex={0} onKeyDown={onKey} onBlur={() => setHover(null)} className="block outline-none">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + w} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} shapeRendering="crispEdges" />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tnum fill-[var(--muted)] text-[11px]">
                {yFormat(t)}
              </text>
            </g>
          ))}
          {categories.map((c, i) => {
            const cx = m.left + band * i + band / 2;
            const x0 = cx - groupW / 2;
            let acc = 0;
            const active = hover === i;
            return (
              <g key={c} opacity={hover !== null && !active ? 0.55 : 1} style={{ transition: "opacity 120ms" }}>
                {active && <rect x={m.left + band * i + 1} y={m.top} width={band - 2} height={h} fill="var(--ink)" fillOpacity={0.035} rx={6} />}
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  if (stacked) {
                    const top = y(acc + v);
                    const bottom = y(acc);
                    acc += v;
                    const isTop = si === series.length - 1 || series.slice(si + 1).every((t) => !(t.values[i] > 0));
                    const segH = Math.max(0, bottom - top - (si > 0 ? gap : 0));
                    return isTop ? (
                      <path key={s.id} d={columnPath(x0, top, barW, segH)} fill={s.color} />
                    ) : (
                      <rect key={s.id} x={x0} y={top} width={barW} height={segH} fill={s.color} />
                    );
                  }
                  const bx = x0 + si * (barW + gap);
                  return <path key={s.id} d={columnPath(bx, y(v), barW, m.top + h - y(v))} fill={s.color} />;
                })}
                {highlight === i && (
                  <text x={cx} y={y(stacked ? series.reduce((a, s) => a + (s.values[i] ?? 0), 0) : Math.max(...series.map((s) => s.values[i] ?? 0))) - 7} textAnchor="middle" className="tnum fill-[var(--ink)] text-[11px] font-semibold">
                    {fmtVal(stacked ? series.reduce((a, s) => a + (s.values[i] ?? 0), 0) : series[series.length - 1].values[i])}
                  </text>
                )}
                {i % labelEvery === 0 && (
                  <text x={cx} y={height - 8} textAnchor="middle" className={`text-[11px] ${active || highlight === i ? "fill-[var(--ink)] font-medium" : "fill-[var(--muted)]"}`}>
                    {c}
                  </text>
                )}
                <rect
                  x={m.left + band * i}
                  y={m.top}
                  width={band}
                  height={h + m.bottom}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div
          className="viz-tip"
          style={{
            left: Math.min(Math.max(m.left + band * hover + band / 2, 80), width - 80),
            top: y(stacked ? series.reduce((a, s) => a + (s.values[hover] ?? 0), 0) : Math.max(...series.map((s) => s.values[hover] ?? 0))),
          }}
        >
          <div className="mb-1 text-[11px] text-white/60">{categories[hover]}</div>
          {[...series].reverse().map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
              <span className="tnum font-semibold">{fmtVal(s.values[hover] ?? 0)}</span>
              <span className="text-white/65">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
