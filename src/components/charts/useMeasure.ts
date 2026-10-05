"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Tracks an element's content width so SVG charts can render at true pixel size. */
export function useMeasure<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A "nice" step (1, 2 or 5 × 10ⁿ) that splits `span` into about `count` parts. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  // same thresholds as d3: pick the step whose tick count lands closest to `count`
  return (norm >= 7.07 ? 10 : norm >= 3.16 ? 5 : norm >= 1.41 ? 2 : 1) * mag;
}

/** "Nice" axis ticks for a [min, max] domain. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) return [min];
  const step = niceStep(max - min, count);
  const start = Math.ceil(min / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-6; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

/** Rounds a maximum up to the next nice step, so the top gridline is labelled. */
export function niceMax(max: number, count = 4): number {
  if (max <= 0) return 1;
  const step = niceStep(max, count);
  return Math.ceil(max / step - 1e-9) * step;
}
