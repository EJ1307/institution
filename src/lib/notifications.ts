// Role-specific notifications derived from live demo data.

import { classDay, currentSchoolDay, isMarked, leaveRequests, markFor } from "./data/attendance";
import { notices } from "./data/communication";
import { feeAccount, ledger } from "./data/fees";
import { studentById } from "./data/people";
import { busStatus, ROUTE_BY_ID, ROUTES } from "./data/transport";
import { fmtDay, plural, rupees } from "./format";
import type { AppState, Role } from "./store";

export type Notification = { id: string; title: string; body: string; href: string; tone: "bad" | "warn" | "info" | "good"; time: string };

export function notificationsFor(role: Role, st: AppState): Notification[] {
  const d = currentSchoolDay();
  const out: Notification[] = [];
  if (role === "admin") {
    if (!isMarked("8-B", d)) out.push({ id: "n-8b", title: "VIII-B register not marked", body: "Ms. Kavya Iyer hasn't submitted today's attendance yet.", href: "/attendance", tone: "warn", time: "8:45 am" });
    const pending = leaveRequests().filter((l) => l.status === "pending");
    if (pending.length) out.push({ id: "n-leave", title: `${plural(pending.length, "leave request")} awaiting approval`, body: pending.slice(0, 2).map((l) => `${l.staff.title} ${l.staff.name}`).join(", ") + (pending.length > 2 ? "…" : ""), href: "/staff", tone: "info", time: "Today" });
    const L = ledger();
    out.push({ id: "n-overdue", title: `${plural(L.defaulters.length, "family", "families")} with overdue fees`, body: `${rupees(L.overdue)} outstanding beyond the due date.`, href: "/fees", tone: "bad", time: "Today" });
    const late = ROUTES.map((r) => ({ r, s: busStatus(r, new Date()) })).filter((x) => x.s.delay > 2 && (x.s.phase === "morning" || x.s.phase === "afternoon"));
    for (const x of late.slice(0, 1)) out.push({ id: `n-bus-${x.r.id}`, title: `Bus ${x.r.id} running ${x.s.delay} min late`, body: `${x.r.name} · ${x.r.bus}`, href: "/transport", tone: "warn", time: "Live" });
    const c = classDay("10-C", d);
    if (c.rate < 0.88) out.push({ id: "n-10c", title: "X-C attendance below 88%", body: `${c.absent + c.leave} of ${c.total} students absent today.`, href: "/attendance", tone: "warn", time: "Today" });
  }
  if (role === "teacher") {
    if (!isMarked("8-B", d)) out.push({ id: "t-reg", title: "Mark today's register for VIII-B", body: "Registers close at 9:30 am.", href: "/attendance", tone: "warn", time: "Now" });
    out.push({ id: "t-hw", title: "11 homework submissions to review", body: "Exercise 4.3 · VIII-B and VIII-C", href: "/homework", tone: "info", time: "Yesterday" });
    out.push({ id: "t-staff", title: "Staff meeting on Thursday, 2:30 pm", body: "Bring draft question banks for the next periodic test.", href: "/notices", tone: "info", time: "Yesterday" });
  }
  if (role === "parent") {
    const child = studentById(st.childId);
    if (child) {
      const acc = feeAccount(child);
      if (acc.nextDue) out.push({ id: `p-fee-${child.id}`, title: `${acc.nextDue.label} fee due ${fmtDay(acc.nextDue.due)}`, body: `${rupees(acc.nextDue.amount)} for ${child.firstName}. Pay securely in a few taps.`, href: "/fees", tone: acc.nextDue.status === "overdue" ? "bad" : "warn", time: "Reminder" });
      const m = markFor(child, d);
      if (m) out.push({ id: `p-att-${child.id}`, title: m === "A" ? `${child.firstName} was marked absent` : `${child.firstName} reached school`, body: m === "A" ? "If this is unexpected, please call the front office." : `Marked ${m === "L" ? "late" : "present"} at ${m === "L" ? "8:14" : "7:52"} am`, href: "/attendance", tone: m === "A" ? "bad" : "good", time: "Today" });
      const route = child.routeId ? ROUTE_BY_ID[child.routeId] : null;
      if (route) {
        const s = busStatus(route, new Date());
        if (s.phase === "morning" || s.phase === "afternoon") out.push({ id: "p-bus", title: `Bus ${route.id} is on the way`, body: s.label, href: "/transport", tone: "info", time: "Live" });
      }
    }
    for (const n of notices().filter((n) => n.requiresAck && !st.acks[n.id] && /Parents|parents/.test(n.audience)).slice(0, 2)) {
      out.push({ id: `p-ack-${n.id}`, title: "Response needed", body: n.title, href: "/notices", tone: "warn", time: fmtDay(n.postedAt) });
    }
  }
  return out;
}
