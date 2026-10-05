"use client";

import { Check, CheckCircle2, ChevronRight } from "lucide-react";
import { Badge, Button, cn } from "@/components/ui/primitives";
import { fmtDay, fmtTime, relativeDays } from "@/lib/format";
import { categoryTone, isConsent } from "./model";

export type FeedNotice = {
  id: string;
  title: string;
  body: string;
  category: string;
  author: string;
  postedAt: Date;
  requiresAck: boolean;
};

export function postedLabel(d: Date, now: Date) {
  const rel = relativeDays(d, now);
  return rel === "Today" ? fmtTime(d) : rel === "Yesterday" ? `Yesterday, ${fmtTime(d)}` : rel;
}

export function ackLabel(n: { title: string; body: string }, at: string) {
  const d = new Date(at);
  return `${isConsent(n) ? "You gave consent" : "You acknowledged"} on ${fmtDay(d)}, ${fmtTime(d)}`;
}

/** One notice in the parent feed. Also used, unchanged, for the compose preview. */
export function FeedCard({
  n,
  now,
  unread,
  ackAt,
  forLabel,
  onOpen,
  onAck,
  compact,
}: {
  n: FeedNotice;
  now: Date;
  unread?: boolean;
  ackAt?: string;
  forLabel?: string;
  onOpen?: () => void;
  onAck?: () => void;
  /** phone-preview scale */
  compact?: boolean;
}) {
  const consent = isConsent(n);
  return (
    <article
      className={cn(
        "relative rounded-[14px] border bg-surface shadow-[var(--shadow-card)] transition-colors",
        unread ? "border-[color-mix(in_oklab,var(--brand)_28%,var(--line))]" : "border-line",
        onOpen && "hover:border-line-strong",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className={cn("block w-full text-left disabled:cursor-default", compact ? "px-3 pt-3 pb-2.5" : "px-4 pt-4 pb-3.5")}
        aria-label={onOpen ? `Open notice: ${n.title}` : undefined}
      >
        <div className="flex items-center gap-2">
          {unread && <span className="size-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
          <Badge tone={categoryTone(n.category)} className={compact ? "h-[18px] px-1.5 text-[10px]" : undefined}>
            {n.category}
          </Badge>
          {forLabel && <span className={cn("truncate text-muted", compact ? "text-[10px]" : "text-[12px]")}>{forLabel}</span>}
          <span className={cn("ml-auto shrink-0 text-faint", compact ? "text-[10px]" : "text-[12px]")}>{postedLabel(n.postedAt, now)}</span>
        </div>
        <h3 className={cn("mt-2 leading-snug text-ink", unread ? "font-semibold" : "font-medium", compact ? "text-[12.5px]" : "text-[15px]")}>{n.title || "Untitled notice"}</h3>
        <p className={cn("mt-1 line-clamp-2 text-ink-2", compact ? "text-[11px] leading-[15px]" : "text-[13.5px] leading-[20px]")}>{n.body || "Your message will appear here."}</p>
        <div className={cn("mt-2 flex items-center justify-between gap-2 text-muted", compact ? "text-[10px]" : "text-[12px]")}>
          <span className="truncate">{n.author}</span>
          {onOpen && <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />}
        </div>
      </button>
      {n.requiresAck && (
        <div className={cn("border-t border-line", compact ? "px-3 py-2" : "px-4 py-3")}>
          {ackAt ? (
            <p className={cn("flex items-center gap-1.5 font-medium text-good", compact ? "text-[10.5px]" : "text-[12.5px]")}>
              <CheckCircle2 className={compact ? "size-3" : "size-4"} /> {ackLabel(n, ackAt)}
            </p>
          ) : compact ? (
            <span className="flex h-7 w-full items-center justify-center gap-1 rounded-lg bg-brand text-[11px] font-medium text-white">
              <Check className="size-3" /> {consent ? "Give consent" : "Acknowledge"}
            </span>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12.5px] text-warn">{consent ? "The school needs your consent" : "Please confirm you've read this"}</p>
              <Button variant="primary" onClick={onAck} className="h-10 w-full sm:h-9 sm:w-auto">
                <Check /> {consent ? "Give consent" : "Acknowledge"}
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
