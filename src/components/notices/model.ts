// Notice board model: reach, acknowledgements and read-receipt breakdowns,
// derived deterministically from the seeded numbers (and, for notices posted
// in the demo, from how long ago they went out).

import { notices, type Notice } from "@/lib/data/communication";
import { staff, students, type Student } from "@/lib/data/people";
import { GRADES, GRADE_BY_ID, classLabel, type GradeId } from "@/lib/data/school";
import { hash01 } from "@/lib/rng";
import type { PostedNotice } from "@/lib/store";
import type { Tone } from "@/components/ui/primitives";
import { apportion, apportionCapped, scopeOf, type Scope } from "@/components/comms/audience";

export type BoardNotice = Notice & Partial<Pick<PostedNotice, "audienceKey" | "channels" | "scheduled">> & { posted: boolean };

export const CATEGORIES: Notice["category"][] = ["Academic", "Events", "Fees", "Transport", "Health & safety", "Administrative"];

export const CHANNELS = ["App", "SMS", "WhatsApp", "Email"] as const;
export type Channel = (typeof CHANNELS)[number];

export function categoryTone(c: string): Tone {
  return c === "Fees" ? "warn" : c === "Health & safety" ? "bad" : c === "Transport" ? "info" : c === "Administrative" ? "neutral" : "brand";
}

export function boardNotices(): BoardNotice[] {
  return notices().map((n) => ({ ...n, posted: !/^N\d+$/.test(n.id) }) as BoardNotice);
}

/** Waiting to go out. Uses the wall clock, so a notice sent a second ago is never "scheduled". */
/** Sent less than an hour ago: too early to chase anyone. */
export function isFresh(n: BoardNotice, now: Date) {
  return n.posted && now.getTime() - n.postedAt.getTime() < 3600000;
}

export function isScheduled(n: BoardNotice, _now?: Date) {
  return Boolean(n.scheduled) && n.postedAt.getTime() > Date.now();
}

/** Consent-style notices ask for permission rather than a read receipt. */
export function isConsent(n: { title: string; body: string }) {
  return /consent|permission/i.test(n.title);
}

export function channelsOf(n: BoardNotice): Channel[] {
  if (n.channels?.length) return n.channels as Channel[];
  const scope = scopeOf(n);
  const out: Channel[] = ["App"];
  if (["Fees", "Transport", "Health & safety"].includes(n.category) || n.requiresAck) out.push("SMS");
  if (scope.parents) out.push("WhatsApp");
  if (!scope.classKey && !scope.routeId) out.push("Email");
  return out;
}

export type Reach = { total: number; read: number; acked: number; pending: number };

/** Reach right now. Notices posted in the demo are read progressively over the first hours. */
export function reachOf(n: BoardNotice, now: Date, acks: Record<string, string>): Reach {
  const total = n.reach.total;
  let read = n.reach.read;
  let acked = 0;
  if (n.posted) {
    const mins = Math.max(0, (now.getTime() - n.postedAt.getTime()) / 60000);
    // push notifications get opened fast: about a third within ten minutes, most within two hours
    read = Math.round(total * 0.9 * (1 - Math.exp(-mins / 25)));
    acked = n.requiresAck ? Math.floor(read * 0.82 * (1 - Math.exp(-mins / 40))) : 0;
  } else if (n.requiresAck) {
    acked = Math.round(read * (0.72 + hash01("ack", n.id) * 0.16));
  }
  if (n.requiresAck && acks[n.id]) acked = Math.min(total, acked + 1);
  read = Math.max(read, acked);
  return { total, read, acked, pending: n.requiresAck ? total - acked : total - read };
}

// ——— Read receipts by group ————————————————————————————————————————

export type ReceiptRow = { key: string; label: string; sub?: string; total: number; read: number; acked: number };

export type FamilyReceipt = { student: Student; read: boolean; acked: boolean; at: Date | null };

/**
 * Break a notice's reach down by class (or grade, route class, department).
 * Group sizes come from the real rolls, scaled so the rows add up to the headline.
 */
export function receiptsByGroup(n: BoardNotice, r: Reach): ReceiptRow[] {
  const scope = scopeOf(n);
  const groups = groupsFor(scope);
  if (!groups.length) return [];
  const totals = apportion(r.total, groups.map((g) => g.size));
  const rate = r.read / (r.total || 1);
  const readW = groups.map((g, i) => totals[i] * Math.min(1, Math.max(0.2, rate + (hash01("rd", n.id, g.key) - 0.5) * 0.18)));
  const reads = apportionCapped(r.read, readW, totals);
  const ackW = groups.map((g, i) => reads[i] * (0.8 + hash01("ak", n.id, g.key) * 0.4));
  const acks = n.requiresAck ? apportionCapped(r.acked, ackW, reads) : groups.map(() => 0);
  return groups.map((g, i) => ({ key: g.key, label: g.label, sub: g.sub, total: totals[i], read: reads[i], acked: acks[i] }));
}

function groupsFor(scope: Scope): { key: string; label: string; sub?: string; size: number }[] {
  const all = students();
  if (!scope.parents && scope.staff) {
    const pool = staff().filter((s) => scope.staff === "all" || s.category === "Teaching");
    const by = new Map<string, number>();
    pool.forEach((s) => by.set(s.department, (by.get(s.department) ?? 0) + 1));
    return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([d, size]) => ({ key: d, label: d, size }));
  }
  if (scope.routeId) {
    const on = all.filter((s) => s.routeId === scope.routeId);
    return GRADES.map((g) => ({ g, size: on.filter((s) => s.grade === g.id).length }))
      .filter((x) => x.size > 0)
      .map((x) => ({ key: x.g.id, label: x.g.label, size: x.size }));
  }
  const grades = scope.grades ?? GRADES.map((g) => g.id);
  const rows: { key: string; label: string; sub?: string; size: number }[] =
    grades.length <= 3
      ? GRADES.filter((g) => grades.includes(g.id)).flatMap((g) =>
          g.sections.map((sec) => ({ key: `${g.id}-${sec}`, label: classLabel(g.id, sec), size: all.filter((s) => s.classKey === `${g.id}-${sec}`).length })),
        )
      : GRADES.filter((g) => grades.includes(g.id)).map((g) => ({ key: g.id, label: g.label, sub: `${g.sections.length} sections`, size: all.filter((s) => s.grade === g.id).length }));
  if (scope.staff) rows.push({ key: "staff", label: "Staff", sub: undefined, size: staff().length });
  return rows;
}

/** Per-family receipts for a single-class notice (teacher's view of their own message). */
export function familyReceipts(n: BoardNotice, r: Reach, kids: Student[]): FamilyReceipt[] {
  const ranked = [...kids].sort((a, b) => hash01("fr", n.id, a.id) - hash01("fr", n.id, b.id));
  const readSet = new Set(ranked.slice(0, r.read).map((s) => s.id));
  const ackSet = new Set(ranked.slice(0, r.acked).map((s) => s.id));
  const now = Date.now();
  return kids.map((s) => {
    const read = readSet.has(s.id);
    const lag = Math.round(4 + hash01("lag", n.id, s.id) * 160);
    const at = read ? new Date(Math.min(now, n.postedAt.getTime() + lag * 60000)) : null;
    return { student: s, read, acked: ackSet.has(s.id), at };
  });
}

export function gradeShort(id: GradeId) {
  return GRADE_BY_ID[id].short;
}
