"use client";

import type { ReactNode } from "react";

/** A setting with a control on the right; the label wraps, the control never moves off-screen. */
export function SettingRow({ label, hint, control, htmlFor }: { label: ReactNode; hint?: ReactNode; control: ReactNode; htmlFor?: string }) {
  const L = htmlFor ? "label" : "span";
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <L htmlFor={htmlFor} className="block text-[13px] text-ink-2">
          {label}
        </L>
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

/** Read-only fact: stacked on phones, label/value on wider screens. */
export function InfoRow({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 text-[13px] sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className="min-w-0 text-ink sm:text-right">{v}</dd>
    </div>
  );
}
