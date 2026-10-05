// Small helpers shared by the admin and parent fee screens.

import { useEffect, useState } from "react";
import { hashInt } from "@/lib/rng";
import { academicYear, addDays, today } from "@/lib/data/calendar";
import { feeAccount, type Instalment, type PaymentMode } from "@/lib/data/fees";
import type { Student } from "@/lib/data/people";
import { fmtDay, fmtTime } from "@/lib/format";
import { getState, setState } from "@/lib/store";

/** Invoices go out this many days before the due date (mirrors the ledger). */
export const INVOICE_LEAD_DAYS = 25;
/** Late fee applies when paid more than this many days after the due date. */
export const GRACE_DAYS = 15;

export const invoiceDate = (due: Date) => addDays(due, -INVOICE_LEAD_DAYS + 1);
export const lateFeeFrom = (due: Date) => addDays(due, GRACE_DAYS + 1);

/** Tick every `ms` so relative times ("2h ago") and live views stay fresh. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** "just now" · "12 min ago" · "2h ago" · "Yesterday, 4:10 pm" · "3 Oct" */
export function ago(iso: string | Date, now: Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${hrs}h ago`;
  const yesterday = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${fmtTime(d)}`;
  return fmtDay(d);
}

// ——— Receipts ————————————————————————————————————————————————————

/** Next receipt number for a payment taken in the demo: AIS/2026-27/5xxxx. */
export function nextReceiptNo() {
  const ay = academicYear(today());
  const taken = Object.values(getState().payments).length;
  return `AIS/${ay.label.replace("–", "-")}/5${String(2140 + taken + 1).padStart(4, "0")}`;
}

/** A plausible bank reference for each payment mode. */
export function makeReference(mode: PaymentMode | string, seed: string) {
  const h = hashInt("ref", seed, Date.now());
  const digits = (n: number, salt: string) => String(hashInt(salt, h)).padStart(10, "0").repeat(2).slice(0, n);
  switch (mode) {
    case "UPI":
      return digits(12, "upi");
    case "Card":
      return `Auth ${digits(6, "card")}`;
    case "Net banking":
      return `NB${digits(10, "nb")}`;
    case "Cheque":
      return `Chq ${digits(6, "chq")}`;
    default:
      return "";
  }
}

export type PaymentInput = {
  student: Student;
  instalment: Instalment;
  mode: PaymentMode;
  reference: string;
  source: "parent" | "office";
};

/** Write a payment to the demo store; every screen re-derives from it. */
export function recordPayment({ student, instalment, mode, reference, source }: PaymentInput) {
  const receipt = nextReceiptNo();
  const key = `${student.id}|${instalment.id}`;
  setState((s) => ({
    payments: {
      ...s.payments,
      [key]: { paidOn: today().toISOString(), mode, receipt, reference: reference || undefined, at: new Date().toISOString(), source },
    },
  }));
  return { receipt, key };
}

export type ReceiptData = {
  receipt: string;
  student: Student;
  instalment: Instalment;
  paidOn: Date;
  at: Date | null;
  mode: PaymentMode;
  reference: string | null;
  source: "parent" | "office" | null;
};

/** Everything a printed receipt needs, looked up by student + instalment. */
export function receiptFor(student: Student, instalmentId: string): ReceiptData | null {
  const acc = feeAccount(student);
  const ins = acc.instalments.find((i) => i.id === instalmentId);
  if (!ins || ins.status !== "paid" || !ins.paidOn) return null;
  const demo = getState().payments[`${student.id}|${instalmentId}`];
  return {
    receipt: ins.receipt!,
    student,
    instalment: ins,
    paidOn: ins.paidOn,
    at: demo?.at ? new Date(demo.at) : null,
    mode: ins.mode!,
    reference: demo?.reference ?? (ins.mode === "Cash" ? null : makeStableRef(ins.mode!, `${student.id}${ins.id}`)),
    source: demo?.source ?? null,
  };
}

function makeStableRef(mode: PaymentMode, seed: string) {
  const h = String(hashInt("stable-ref", seed)).padStart(10, "0");
  const h2 = String(hashInt("stable-ref-2", seed)).padStart(10, "0");
  switch (mode) {
    case "UPI":
      return (h + h2).slice(0, 12);
    case "Card":
      return `Auth ${h.slice(-6)}`;
    case "Net banking":
      return `NB${h}`;
    case "Cheque":
      return `Chq ${h2.slice(-6)}`;
    default:
      return null;
  }
}

// ——— Amount in words (Indian system) ————————————————————————————————

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function twoDigits(n: number) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
}

function threeDigits(n: number) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} hundred` : "", rest ? twoDigits(rest) : ""].filter(Boolean).join(" ");
}

/** 54300 → "Rupees fifty-four thousand three hundred only" */
export function amountInWords(amount: number) {
  let n = Math.round(amount);
  if (n === 0) return "Rupees zero only";
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const parts = [
    crore ? `${twoDigits(crore)} crore` : "",
    lakh ? `${twoDigits(lakh)} lakh` : "",
    thousand ? `${twoDigits(thousand)} thousand` : "",
    n ? threeDigits(n) : "",
  ].filter(Boolean);
  return `Rupees ${parts.join(" ")} only`;
}

