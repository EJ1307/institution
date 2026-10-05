"use client";

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { niceTicks, useMeasure } from "./useMeasure";

export type LineSeries = { id: string; label: string; color: string; values: (number | null)[]; dashed?: boolean };

/**
 * Line / area chart. 2px lines, hairline grid, crosshair that snaps to the
 * nearest x, one tooltip listing every series. Keyboard: ←/→ to step.
 */
export function LineChart({
  labels,
  tickLabel,
  series,
  height = 220,
  yDomain,
  yFormat = (n) => String(n),
  valueFormat,
  area = false,
  target,
  endLabel = false,
  ariaLabel,
}: {
  labels: string[];
  tickLabel?: (i: number) => string | null;
  series: LineSeries[];
  height?: number;
  yDomain?: [number, number];
  yFormat?: (n: number) => string;
  valueFormat?: (n: number) => string;
  area?: boolean;
  target?: { value: number; label: string };
  endLabel?: boolean;
  ariaLabel: string;
}) {
  const [ref, width] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, "");
  const fmtVal = valueFormat ?? yFormat;

  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const [lo, hi] = yDomain ?? [Math.min(...all, target?.value ?? Infinity), Math.max(...all, target?.value ?? -Infinity)];
  const ticks = useMemo(() => niceTicks(lo, hi, 4), [lo, hi]);
  const y0 = yDomain ? yDomain[0] : Math.min(lo, ticks[0]);
  const y1 = yDomain ? yDomain[1] : Math.max(hi, ticks[ticks.length - 1]);

  const longest = Math.max(...ticks.map((t) => yFormat(t).length));
  const m = { top: 10, right: endLabel ? 52 : 10, bottom: 26, left: Math.max(28, longest * 6.6 + 10) };
  const w = Math.max(0, width - m.left - m.right);
  const h = height - m.top - m.bottom;
  const n = labels.length;
  const x = (i: number) => m.left + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => m.top + h - ((v - y0) / (y1 - y0 || 1)) * h;

  const paths = series.map((s) => {
    let d = "";
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    const firstIdx = s.values.findIndex((v) => v !== null);
    let lastIdx = -1;
    s.values.forEach((v, i) => {
      if (v !== null) lastIdx = i;
    });
    const areaD = d && firstIdx >= 0 ? `${d}L${x(lastIdx)},${m.top + h}L${x(firstIdx)},${m.top + h}Z` : "";
    return { s, d, areaD, lastIdx };
  });

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - m.left) / (w || 1)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setHover((h0) => Math.min(n - 1, (h0 ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h0) => Math.max(0, (h0 ?? n) - 1));
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          className="block overflow-visible outline-none focus-visible:[&_.focus-ring]:opacity-100"
        >
          <defs>
            <clipPath id={`clip-${gid}`}>
              <rect x={m.left} y={m.top - 4} width={w} height={h + 8} />
            </clipPath>
          </defs>
          {/* grid + y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + w} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tnum fill-[var(--muted)] text-[11px]">
                {yFormat(t)}
              </text>
            </g>
          ))}
          <line x1={m.left} x2={m.left + w} y1={m.top + h} y2={m.top + h} stroke="var(--axis)" strokeWidth={1} shapeRendering="crispEdges" />
          {/* x labels */}
          {labels.map((_, i) => {
            const t = tickLabel ? tickLabel(i) : i % Math.ceil(n / 6) === 0 ? labels[i] : null;
            return t ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-[var(--muted)] text-[11px]">
                {t}
              </text>
            ) : null;
          })}
          {/* target line */}
          {target && (
            <g>
              <line x1={m.left} x2={m.left + w} y1={y(target.value)} y2={y(target.value)} stroke="var(--ink-2)" strokeOpacity={0.45} strokeWidth={1} />
              <text x={m.left + 6} y={y(target.value) - 5} textAnchor="start" className="fill-[var(--ink-2)] text-[10.5px] font-medium">
                {target.label}
              </text>
            </g>
          )}
          <g clipPath={`url(#clip-${gid})`}>
            {area &&
              paths.map(({ s, areaD }) => <path key={`a-${s.id}`} d={areaD} fill={s.color} fillOpacity={0.09} />)}
            {paths.map(({ s, d }) => (
              <path
                key={s.id}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? "4 4" : undefined}
              />
            ))}
          </g>
          {/* end markers + labels */}
          {paths.map(({ s, lastIdx }) =>
            lastIdx >= 0 && hover === null ? (
              <g key={`e-${s.id}`}>
                <circle cx={x(lastIdx)} cy={y(s.values[lastIdx]!)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                {endLabel && (
                  <text x={x(lastIdx) + 8} y={y(s.values[lastIdx]!)} dy="0.32em" className="tnum fill-[var(--ink)] text-[11.5px] font-semibold">
                    {fmtVal(s.values[lastIdx]!)}
                  </text>
                )}
              </g>
            ) : null,
          )}
          {/* crosshair */}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + h} stroke="var(--ink)" strokeOpacity={0.25} strokeWidth={1} />
              {series.map((s) =>
                s.values[hover] !== null ? (
                  <circle key={s.id} cx={x(hover)} cy={y(s.values[hover]!)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                ) : null,
              )}
            </g>
          )}
          <rect
            x={m.left}
            y={m.top}
            width={w}
            height={h}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div className="viz-tip" style={{ left: Math.min(Math.max(x(hover), 80), width - 80), top: Math.min(...series.map((s) => (s.values[hover] !== null ? y(s.values[hover]!) : m.top + h))) }}>
          <div className="mb-1 text-[11px] text-white/60">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              <span className="tnum font-semibold">{s.values[hover] === null ? "—" : fmtVal(s.values[hover]!)}</span>
              <span className="text-white/65">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
