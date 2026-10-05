"use client";

import { Bus, Check, School } from "lucide-react";
import { useMemo } from "react";
import { useMeasure } from "@/components/charts/useMeasure";
import { cn } from "@/components/ui/primitives";
import type { Route } from "@/lib/data/transport";
import { hashInt } from "@/lib/rng";
import type { Run } from "./live";

type Pt = { x: number; y: number };

const splitName = (name: string) => {
  const [a, b] = name.split(" · ");
  return { primary: a, secondary: b ?? null };
};

/**
 * Schematic route line (metro-map style): stops evenly spaced, 45° bends,
 * the travelled part in the brand colour and a bus marker that glides
 * between positions.
 */
export function RouteMap({
  route,
  position,
  run,
  live,
  highlight,
  highlightLabel = "Your stop",
  height = 176,
  ariaLabel,
  complete = false,
}: {
  route: Route;
  /** the run is over: draw the whole line as travelled, no bus */
  complete?: boolean;
  /** morning-order position 0..n-1, or null when the bus isn't running */
  position: number | null;
  run: Run | null;
  live: boolean;
  highlight?: number | null;
  highlightLabel?: string;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, width] = useMeasure();
  const n = route.stops.length;

  const geo = useMemo(() => {
    const padX = 30;
    const mid = height / 2 + 2;
    const amp = 17;
    // a gentle, route-specific wiggle; the school is always on the centre line
    const levels = route.stops.map((_, i) => (i === n - 1 ? 0 : [-1, 0, 1, 0, -1, 1][(hashInt(route.id, "lvl", i) + i) % 6]));
    const pts: Pt[] = route.stops.map((_, i) => ({ x: padX + (i * (width - padX * 2)) / Math.max(1, n - 1), y: mid + levels[i] * amp }));
    // each segment: stop → short straight → 45° diagonal → straight → next stop
    const segs: Pt[][] = pts.slice(0, -1).map((p, i) => {
      const q = pts[i + 1];
      const dy = q.y - p.y;
      if (dy === 0) return [p, q];
      const run = Math.abs(dy);
      const cx = (p.x + q.x) / 2;
      return [p, { x: cx - run / 2, y: p.y }, { x: cx + run / 2, y: q.y }, q];
    });
    return { pts, segs };
  }, [route, width, height, n]);

  const pointAt = (pos: number): Pt => {
    const i = Math.min(n - 2, Math.max(0, Math.floor(pos)));
    const t = Math.max(0, Math.min(1, pos - i));
    return along(geo.segs[i], t);
  };

  const travelled = useMemo(() => {
    if (complete) return pathBetween(geo.segs, 0, n - 1);
    if (position === null || run === null) return "";
    const [from, to] = run === "am" ? [0, position] : [position, n - 1];
    return pathBetween(geo.segs, from, to);
  }, [geo, position, run, n, complete]);

  const fullPath = geo.segs.map((s, i) => (i === 0 ? "M" : "L") + s.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("L")).join("");
  const bus = position !== null ? pointAt(position) : null;
  const passed = (i: number) => complete || (position !== null && run !== null && (run === "am" ? i <= position : i >= position));
  const narrow = width < 640;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          <path d={fullPath} fill="none" stroke="var(--line-strong)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          {travelled && <path d={travelled} fill="none" stroke="var(--brand)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" style={{ transition: "d 1s linear" }} />}

          {geo.pts.map((p, i) => {
            const isSchool = i === n - 1;
            const { primary, secondary } = splitName(route.stops[i].name);
            const above = i % 2 === 0;
            const anchor = i === 0 ? "start" : isSchool ? "end" : "middle";
            const lx = i === 0 ? p.x - 8 : isSchool ? p.x + 8 : p.x;
            const hl = highlight === i;
            const done = passed(i);
            const twoLines = !narrow && !!secondary;
            const ly = above ? p.y - (twoLines ? 34 : 18) : p.y + 26;
            return (
              <g key={i}>
                {isSchool ? (
                  <g transform={`translate(${p.x - 11},${p.y - 11})`}>
                    <rect width={22} height={22} rx={6} fill="var(--brand-deep)" />
                    <School x={4} y={4} width={14} height={14} color="#fff" strokeWidth={2} />
                  </g>
                ) : (
                  <>
                    {hl && <circle cx={p.x} cy={p.y} r={11} fill="var(--accent)" fillOpacity={0.22} />}
                    <circle cx={p.x} cy={p.y} r={hl ? 7 : 5.5} fill={done ? "var(--brand)" : "var(--surface)"} stroke={hl ? "var(--accent)" : done ? "var(--brand)" : "var(--faint)"} strokeWidth={hl ? 3 : 2} />
                  </>
                )}
                {hl && (
                  <g transform={`translate(${p.x},${above ? p.y + 24 : p.y - 24})`}>
                    <rect x={-31} y={-9} width={62} height={18} rx={9} fill="var(--ink)" />
                    <text textAnchor="middle" dy="0.35em" className="fill-white text-[10.5px] font-semibold">
                      {highlightLabel}
                    </text>
                  </g>
                )}
                <text x={lx} y={ly} textAnchor={anchor} className={cn("text-[11.5px] font-medium", hl ? "fill-[var(--ink)]" : "fill-[var(--ink-2)]")}>
                  {isSchool ? "School" : primary}
                </text>
                {!narrow && secondary && (
                  <text x={lx} y={ly + 14} textAnchor={anchor} className="fill-[var(--muted)] text-[11px]">
                    {secondary}
                  </text>
                )}
              </g>
            );
          })}

          {bus && (
            <g style={{ transform: `translate(${bus.x}px, ${bus.y}px)`, transition: live ? "transform 1.2s linear" : "transform 0.25s linear" }}>
              {live && (
                <circle r={15} fill="var(--brand)" fillOpacity={0.25}>
                  <animate attributeName="r" values="15;27;15" dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.28;0;0.28" dur="2.2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={15} fill="var(--brand)" stroke="var(--surface)" strokeWidth={3} />
              <Bus x={-8} y={-8} width={16} height={16} color="#fff" strokeWidth={2.2} />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

function along(seg: Pt[], t: number): Pt {
  const lens = seg.slice(1).map((p, i) => Math.hypot(p.x - seg[i].x, p.y - seg[i].y));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let d = t * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? Math.min(1, d / lens[i]) : 0;
      return { x: seg[i].x + (seg[i + 1].x - seg[i].x) * f, y: seg[i].y + (seg[i + 1].y - seg[i].y) * f };
    }
    d -= lens[i];
  }
  return seg[seg.length - 1];
}

/** Polyline between two morning-order positions. */
function pathBetween(segs: Pt[][], from: number, to: number) {
  if (to <= from) return "";
  const pts: Pt[] = [];
  const startSeg = Math.min(segs.length - 1, Math.floor(from));
  const endSeg = Math.min(segs.length - 1, Math.ceil(to) - 1);
  for (let i = startSeg; i <= endSeg; i++) {
    const seg = segs[i];
    const t0 = i === startSeg ? from - i : 0;
    const t1 = i === endSeg ? to - i : 1;
    pts.push(along(seg, t0));
    // interior corners that fall inside [t0, t1]
    const lens = seg.slice(1).map((p, k) => Math.hypot(p.x - seg[k].x, p.y - seg[k].y));
    const total = lens.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    for (let k = 0; k < lens.length - 1; k++) {
      acc += lens[k];
      const tc = acc / total;
      if (tc > t0 && tc < t1) pts.push(seg[k + 1]);
    }
    pts.push(along(seg, t1));
  }
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
}

/**
 * Vertical tracker for phones: stops top to bottom in the order the bus will
 * visit them, with the bus marker sliding down the line.
 */
export function RouteTrack({
  route,
  run,
  position,
  live,
  highlight,
  times,
  actual,
  rowHeight = 56,
  complete = false,
}: {
  /** the run is over: whole line travelled, no bus marker */
  complete?: boolean;
  route: Route;
  /** order of travel to show */
  run: Run;
  /** morning-order position, or null */
  position: number | null;
  live: boolean;
  highlight?: number | null;
  /** scheduled/expected time label per stop (morning-order index) */
  times: string[];
  /** actual arrival label per stop when already reached */
  actual?: (string | null)[];
  rowHeight?: number;
}) {
  const n = route.stops.length;
  const order = run === "am" ? route.stops.map((_, i) => i) : route.stops.map((_, i) => n - 1 - i);
  // position along the displayed order
  const p = complete ? n - 1 : position === null ? null : run === "am" ? position : n - 1 - position;
  const reached = (row: number) => p !== null && row <= p + 1e-6;
  const top = (row: number) => row * rowHeight + 14;

  return (
    <div className="relative" style={{ height: (n - 1) * rowHeight + 32 }}>
      {/* line */}
      <div className="absolute left-[13px] w-[3px] rounded-full bg-line-strong" style={{ top: top(0), height: (n - 1) * rowHeight }} aria-hidden />
      {p !== null && <div className="absolute left-[13px] w-[3px] rounded-full bg-brand transition-[height] duration-1000 ease-linear" style={{ top: top(0), height: p * rowHeight }} aria-hidden />}

      <ol>
        {order.map((idx, row) => {
          const st = route.stops[idx];
          const isSchool = idx === n - 1;
          const hl = highlight === idx;
          const done = reached(row);
          const { primary, secondary } = splitName(st.name);
          return (
            <li key={idx} className="absolute inset-x-0 flex items-start gap-3.5" style={{ top: top(row) - 10 }}>
              <span
                className={cn(
                  "relative z-[1] mt-0.5 grid shrink-0 place-items-center rounded-full",
                  isSchool ? "size-[29px] rounded-lg bg-brand-deep text-white" : hl ? "size-[29px] border-[3px]" : "ml-[5px] size-[19px] border-2",
                  !isSchool && (done ? "border-brand bg-brand text-white" : hl ? "border-accent bg-surface" : "border-faint bg-surface"),
                )}
              >
                {isSchool ? <School className="size-4" /> : done ? <Check className={hl ? "size-3.5" : "size-3"} strokeWidth={3} /> : hl ? <span className="size-2.5 rounded-full bg-accent" /> : null}
              </span>
              <div className={cn("flex min-w-0 flex-1 items-start justify-between gap-3 pt-0.5", !isSchool && !hl && "pl-[5px]")}>
                <div className="min-w-0">
                  <p className={cn("truncate text-[13.5px] leading-5", hl ? "font-semibold text-ink" : done ? "text-muted" : "font-medium text-ink")}>
                    {isSchool ? "School" : primary}
                    {hl && <span className="ml-2 rounded-full bg-ink px-1.5 py-0.5 align-[1px] text-[10px] font-semibold text-white">Your stop</span>}
                  </p>
                  {secondary && <p className="truncate text-[12px] text-muted">{secondary}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn("tnum text-[12.5px]", hl ? "font-semibold text-ink" : done ? "text-muted" : "text-ink-2")}>{actual?.[idx] ?? times[idx]}</p>
                  {actual?.[idx] && <p className="text-[11px] text-faint">reached</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {p !== null && !complete && (
        <div className="absolute left-0 z-[2] transition-[top] duration-1000 ease-linear" style={{ top: top(0) + p * rowHeight - 15 }} aria-hidden>
          <span className="relative grid size-[30px] place-items-center rounded-full border-[3px] border-surface bg-brand text-white shadow-[0_2px_6px_rgb(0_0_0/0.18)]">
            {live && <span className="absolute inset-0 animate-ping rounded-full bg-brand/25" style={{ animationDuration: "2.2s" }} />}
            <Bus className="relative size-3.5" strokeWidth={2.4} />
          </span>
        </div>
      )}
    </div>
  );
}
