// Fee accounts: quarterly instalments, concessions, transport, payment
// behaviour by family, plus anything paid inside the demo.

import { hash01 } from "@/lib/rng";
import { getState } from "@/lib/store";
import { academicYear, addDays, today } from "./calendar";
import { INSTALMENTS, TRANSPORT_QUARTERLY, annualTuition, instalmentDue, type InstalmentId } from "./school";
import { PERSONA_PARENT, students, type Student } from "./people";

export const PAYMENT_MODES = ["UPI", "Net banking", "Card", "Cheque", "Cash"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
const MODE_WEIGHTS = [0.44, 0.21, 0.15, 0.12, 0.08];

export const LATE_FEE = 500;
const WINDOW_DAYS = 25; // invoices go out this many days before the due date

export type InstalmentStatus = "paid" | "due" | "overdue" | "upcoming";

export type Instalment = {
  id: InstalmentId;
  label: string;
  covers: string;
  due: Date;
  tuition: number;
  transport: number;
  concession: number;
  lateFee: number;
  amount: number;
  status: InstalmentStatus;
  paidOn: Date | null;
  mode: PaymentMode | null;
  receipt: string | null;
};

export type FeeAccount = {
  student: Student;
  instalments: Instalment[];
  annual: number;
  paid: number;
  outstanding: number; // due + overdue
  overdue: number;
  nextDue: Instalment | null;
};

function pickMode(key: string): PaymentMode {
  const x = hash01("mode", key);
  let acc = 0;
  for (let i = 0; i < PAYMENT_MODES.length; i++) {
    acc += MODE_WEIGHTS[i];
    if (x < acc) return PAYMENT_MODES[i];
  }
  return "UPI";
}

function payDate(s: Student, insId: string, due: Date): Date | null {
  // The demo parent pays on the due date itself, so there's usually an open
  // instalment to walk through the "Pay now" flow with.
  if (s.parentId === PERSONA_PARENT.id) return due;
  const h = hash01("pay", s.id, insId);
  if (s.feeProfile === "punctual") return addDays(due, -Math.floor(h * 22));
  if (s.feeProfile === "late") return addDays(due, 3 + Math.floor(h * 38));
  // defaulters paid Q1 very late and nothing since
  return insId === "Q1" ? addDays(due, 25 + Math.floor(h * 40)) : null;
}

const accountCache = new Map<string, FeeAccount>();
let cacheStamp = "";

export function feeAccount(s: Student): FeeAccount {
  const t = today();
  const st = getState();
  const stamp = `${t.getTime()}|${Object.keys(st.payments).length}`;
  if (stamp !== cacheStamp) {
    accountCache.clear();
    cacheStamp = stamp;
  }
  const hit = accountCache.get(s.id);
  if (hit) return hit;

  const ay = academicYear(t);
  const tuitionQ = annualTuition(s.grade) / 4;
  const transportQ = s.routeId ? TRANSPORT_QUARTERLY : 0;
  const concessionQ = s.concession ? Math.round((tuitionQ * s.concession.pct) / 100) : 0;

  const instalments: Instalment[] = INSTALMENTS.map((ins, idx) => {
    const due = instalmentDue(ins.id, ay.startYear);
    const base = tuitionQ - concessionQ + transportQ;
    const demoPaid = st.payments[`${s.id}|${ins.id}`];
    let paidOn = demoPaid ? new Date(demoPaid.paidOn) : payDate(s, ins.id, due);
    if (paidOn && paidOn > t) paidOn = null;
    if (paidOn && paidOn < addDays(due, -WINDOW_DAYS)) paidOn = addDays(due, -WINDOW_DAYS + 1);
    const daysLate = paidOn ? Math.round((paidOn.getTime() - due.getTime()) / 86400000) : Math.round((t.getTime() - due.getTime()) / 86400000);
    const lateFee = daysLate > 15 ? LATE_FEE : 0;
    let status: InstalmentStatus;
    if (paidOn) status = "paid";
    else if (t > due) status = "overdue";
    else if (t >= addDays(due, -WINDOW_DAYS)) status = "due";
    else status = "upcoming";
    return {
      id: ins.id,
      label: ins.label,
      covers: ins.covers,
      due,
      tuition: tuitionQ,
      transport: transportQ,
      concession: concessionQ,
      lateFee,
      amount: base + lateFee,
      status,
      paidOn,
      mode: paidOn ? ((demoPaid?.mode as PaymentMode) ?? pickMode(`${s.id}${ins.id}`)) : null,
      receipt: paidOn ? (demoPaid?.receipt ?? `AIS/${ay.label.replace("–", "-")}/${String(idx + 1)}${s.id.replace(/\D/g, "").padStart(4, "0")}`) : null,
    };
  });

  const annual = instalments.reduce((a, i) => a + i.amount - i.lateFee, 0);
  const paid = instalments.filter((i) => i.status === "paid").reduce((a, i) => a + i.amount, 0);
  const overdue = instalments.filter((i) => i.status === "overdue").reduce((a, i) => a + i.amount, 0);
  const outstanding = overdue + instalments.filter((i) => i.status === "due").reduce((a, i) => a + i.amount, 0);
  const nextDue = instalments.find((i) => i.status === "overdue" || i.status === "due") ?? null;
  const acc: FeeAccount = { student: s, instalments, annual, paid, outstanding, overdue, nextDue };
  accountCache.set(s.id, acc);
  return acc;
}

export type Transaction = {
  receipt: string;
  student: Student;
  instalment: string;
  amount: number;
  mode: PaymentMode;
  date: Date;
};

export function feeLedger() {
  const t = today();
  const ay = academicYear(t);
  const accounts = students().map(feeAccount);
  const txns: Transaction[] = [];
  let billed = 0;
  let collected = 0;
  let overdue = 0;
  let dueNow = 0;
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(ay.startYear, 3 + i, 1);
    return { month: d, collected: 0, expected: 0 };
  });
  const monthIndex = (d: Date) => (d.getFullYear() - ay.startYear) * 12 + d.getMonth() - 3;
  const modes = Object.fromEntries(PAYMENT_MODES.map((m) => [m, 0])) as Record<PaymentMode, number>;
  const byInstalment = INSTALMENTS.map((ins) => ({ id: ins.id, label: ins.label, covers: ins.covers, due: instalmentDue(ins.id, ay.startYear), paid: 0, overdue: 0, open: 0, upcoming: 0 }));

  for (const a of accounts) {
    a.instalments.forEach((i, idx) => {
      const bucket = byInstalment[idx];
      if (i.status === "paid") bucket.paid += i.amount;
      else if (i.status === "overdue") bucket.overdue += i.amount;
      else if (i.status === "due") bucket.open += i.amount;
      else bucket.upcoming += i.amount;
      const mi = monthIndex(i.due);
      if (mi >= 0 && mi < 12) months[mi].expected += i.amount - i.lateFee;
      if (i.status !== "upcoming") billed += i.amount;
      if (i.status === "overdue") overdue += i.amount;
      if (i.status === "due") dueNow += i.amount;
      if (i.status === "paid" && i.paidOn) {
        collected += i.amount;
        modes[i.mode!] += i.amount;
        const pm = monthIndex(i.paidOn);
        if (pm >= 0 && pm < 12) months[pm].collected += i.amount;
        txns.push({ receipt: i.receipt!, student: a.student, instalment: i.id, amount: i.amount, mode: i.mode!, date: i.paidOn });
      }
    });
  }
  txns.sort((x, y) => y.date.getTime() - x.date.getTime() || x.receipt.localeCompare(y.receipt));
  const annualTotal = accounts.reduce((acc, a) => acc + a.annual, 0);
  const defaulters = accounts.filter((a) => a.overdue > 0).sort((x, y) => y.overdue - x.overdue);
  return { accounts, txns, billed, collected, overdue, dueNow, annualTotal, months, modes, defaulters, byInstalment };
}

let ledgerCache: { stamp: string; value: ReturnType<typeof feeLedger> } | null = null;

/** Memoised ledger (recomputed when the date or demo payments change). */
export function ledger() {
  const stamp = `${today().getTime()}|${Object.keys(getState().payments).length}`;
  if (!ledgerCache || ledgerCache.stamp !== stamp) ledgerCache = { stamp, value: feeLedger() };
  return ledgerCache.value;
}
