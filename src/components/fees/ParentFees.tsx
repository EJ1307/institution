"use client";

import { ArrowRight, CalendarClock, Check, CheckCircle2, Download, HandCoins, Mail, Phone } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/layout";
import { Badge, Button, Card, CardHeader, cn } from "@/components/ui/primitives";
import { academicYear, addDays, today } from "@/lib/data/calendar";
import { feeAccount, LATE_FEE, type Instalment } from "@/lib/data/fees";
import { classLabelLong } from "@/lib/data/school";
import { fmtDate, fmtDay, fmtWeekday, plural, rupees } from "@/lib/format";
import { useChild } from "@/lib/session";
import { useAppState } from "@/lib/store";
import { PaySheet } from "./PaySheet";
import { ReceiptSheet } from "./Receipt";
import { GRACE_DAYS, invoiceDate, receiptFor, type ReceiptData } from "./lib";

export function ParentFees() {
  const { child, children } = useChild();
  const payments = useAppState((s) => s.payments);
  const acc = useMemo(() => feeAccount(child), [child, payments]);
  const [paying, setPaying] = useState<Instalment | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // "Pay" on the parent home links here with ?pay=1: open the payment sheet straight away
  const params = useSearchParams();
  const wantsPay = params.get("pay") === "1";
  useEffect(() => {
    if (!wantsPay || !acc.nextDue) return;
    setPaying(acc.nextDue);
    window.history.replaceState(null, "", "/fees");
  }, [wantsPay]);

  const t = today();
  const ay = academicYear(t);
  const next = acc.nextDue;
  const upcoming = acc.instalments.find((i) => i.status === "upcoming") ?? null;
  const paidList = acc.instalments.filter((i) => i.status === "paid");
  const sibling = children.find((c) => c.id !== child.id);
  const yearTotal = acc.instalments.reduce((a, i) => a + i.amount, 0);

  return (
    <>
      <PageHeader eyebrow={`Fees & payments · AY ${ay.label}`} title={`${child.firstName}'s fees`} description={`${classLabelLong(child.grade, child.section)} · Admission no. ${child.admissionNo}`} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {next ? (
            <NextPayment ins={next} childName={child.firstName} routeId={child.routeId} concessionLabel={child.concession ? `${child.concession.label} concession · ${child.concession.pct}%` : null} onPay={() => setPaying(next)} />
          ) : (
            <AllClear upcoming={upcoming} childName={child.firstName} lastPaid={paidList[paidList.length - 1] ?? null} onReceipt={(i) => setReceipt(receiptFor(child, i.id))} />
          )}

          <Card>
            <CardHeader
              title={`${ay.label} at a glance`}
              description={`${rupees(acc.paid)} paid of ${rupees(yearTotal)} · ${plural(paidList.length, "instalment")} of 4`}
            />
            <div className="px-5 pb-2">
              <div className="flex gap-1" aria-hidden>
                {acc.instalments.map((i) => (
                  <span key={i.id} className={cn("h-2 flex-1 rounded-full", { paid: "bg-brand", due: "bg-[#D9961F]", overdue: "bg-bad", upcoming: "bg-ink/[0.08]" }[i.status])} />
                ))}
              </div>
            </div>
            <ol className="px-5 pt-2 pb-3">
              {acc.instalments.map((i, idx) => (
                <TimelineRow key={i.id} ins={i} last={idx === acc.instalments.length - 1} onPay={() => setPaying(i)} onReceipt={() => setReceipt(receiptFor(child, i.id))} />
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Receipts" description={paidList.length ? "Tap to view, print or save as PDF" : undefined} />
            {paidList.length === 0 ? (
              <p className="px-5 pb-5 text-[13px] text-muted">Receipts appear here as soon as a payment goes through.</p>
            ) : (
              <ul className="px-2 pb-2">
                {[...paidList].reverse().map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => setReceipt(receiptFor(child, i.id))}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-2"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                        <Download className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-ink">
                          {i.label} · {i.covers}
                        </span>
                        <span className="tnum block truncate text-[12px] text-muted">
                          {i.receipt} · {fmtDay(i.paidOn!)}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-[13px] font-semibold">{rupees(i.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Concessions" icon={<HandCoins />} />
            <div className="px-5 pb-5 text-[13px] leading-relaxed text-ink-2">
              {child.concession ? (
                <>
                  <p>
                    <span className="font-medium text-ink">
                      {child.concession.label} concession · {child.concession.pct}% of tuition
                    </span>
                    {child.concession.label === "Sibling" && sibling ? ` — because ${sibling.firstName} also studies at Amaltas.` : "."}
                  </p>
                  <p className="mt-2 text-muted">
                    That's {rupees(acc.instalments[0].concession)} off every quarter, {rupees(acc.instalments[0].concession * 4)} this year. It's applied to each invoice automatically.
                  </p>
                </>
              ) : (
                <>
                  <p>No concession applies to {child.firstName}'s account.</p>
                  <p className="mt-2 text-muted">
                    {sibling?.concession?.label === "Sibling"
                      ? `The 10% sibling concession goes on the younger child's fees, so it shows on ${sibling.firstName}'s account. `
                      : ""}
                    Merit scholarships (25% of tuition) are reviewed every April on the final exam results.
                  </p>
                </>
              )}
            </div>
          </Card>

          <Card className="px-5 py-4">
            <p className="text-[13px] font-medium">Questions about fees?</p>
            <p className="mt-0.5 text-[12.5px] text-muted">Accounts office · Mon–Sat, 8:00 am – 2:30 pm</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="tel:+911244567890" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong/80 bg-surface px-2.5 text-[12.5px] font-medium hover:bg-surface-2">
                <Phone className="size-3.5" /> 0124 456 7890
              </a>
              <a href="mailto:accounts@amaltas.edu.in" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong/80 bg-surface px-2.5 text-[12.5px] font-medium hover:bg-surface-2">
                <Mail className="size-3.5" /> accounts@amaltas.edu.in
              </a>
            </div>
          </Card>
        </div>
      </div>

      <PaySheet open={!!paying} onClose={() => setPaying(null)} student={child} instalment={paying} />
      <ReceiptSheet data={receipt} open={!!receipt} onClose={() => setReceipt(null)} />
    </>
  );
}

function NextPayment({
  ins,
  childName,
  routeId,
  concessionLabel,
  onPay,
}: {
  ins: Instalment;
  childName: string;
  routeId: string | null;
  concessionLabel: string | null;
  onPay: () => void;
}) {
  const t = today();
  const days = Math.round((ins.due.getTime() - t.getTime()) / 86400000);
  const overdue = ins.status === "overdue";
  const payBy = addDays(ins.due, GRACE_DAYS);
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">Next payment</span>
            {overdue ? (
              <Badge tone="bad" dot>
                Overdue by {plural(-days, "day")}
              </Badge>
            ) : (
              <Badge tone={days <= 7 ? "warn" : "neutral"} dot>
                {days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`}
              </Badge>
            )}
          </div>
          <p className="tnum mt-4 text-[40px] leading-none font-semibold tracking-[-0.03em] text-ink">{rupees(ins.amount)}</p>
          <p className="mt-2 text-[13.5px] text-ink-2">
            {ins.label} · {ins.covers} · due <span className="font-medium text-ink">{fmtWeekday(ins.due)}</span>
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted">Tuition{ins.transport ? " and school bus" : ""} for {childName}, {ins.covers.replace("–", " to ")}</p>
          <div className="mt-6 md:mt-auto md:pt-6">
            <Button variant="primary" size="lg" className="w-full sm:w-auto sm:min-w-[220px]" onClick={onPay}>
              Pay {rupees(ins.amount)} <ArrowRight />
            </Button>
            <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted">
              <CalendarClock className="size-3.5 shrink-0" />
              {overdue
                ? ins.lateFee
                  ? `Includes the ${rupees(LATE_FEE)} late fee, added after ${GRACE_DAYS} days.`
                  : `Pay by ${fmtDay(payBy)} to avoid the ${rupees(LATE_FEE)} late fee.`
                : `Pay by ${fmtDay(payBy)} to avoid the ${rupees(LATE_FEE)} late fee.`}
            </p>
          </div>
        </div>
        <dl className="border-t border-line bg-surface-2 px-5 py-4 text-[13px] sm:px-6 md:border-t-0 md:border-l md:py-6">
          <p className="mb-2 text-[12px] font-medium text-muted">What it covers</p>
          <Line k="Tuition fee" v={rupees(ins.tuition)} />
          {ins.transport > 0 && <Line k={`School bus${routeId ? ` · Route ${routeId}` : ""}`} v={rupees(ins.transport)} />}
          {ins.concession > 0 && <Line k={concessionLabel ?? "Concession"} v={`−${rupees(ins.concession)}`} tone="good" />}
          <Line k="Late fee" v={ins.lateFee ? rupees(ins.lateFee) : "—"} muted={!ins.lateFee} />
          <div className="mt-2 flex items-baseline justify-between border-t border-line-strong/70 pt-3">
            <dt className="font-semibold text-ink">Total</dt>
            <dd className="tnum font-semibold text-ink">{rupees(ins.amount)}</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

function Line({ k, v, tone, muted }: { k: string; v: string; tone?: "good"; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-ink-2">{k}</dt>
      <dd className={cn("tnum", tone === "good" ? "text-good" : muted ? "text-faint" : "text-ink")}>{v}</dd>
    </div>
  );
}

function AllClear({ upcoming, childName, lastPaid, onReceipt }: { upcoming: Instalment | null; childName: string; lastPaid: Instalment | null; onReceipt: (i: Instalment) => void }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-good-soft text-good">
          <CheckCircle2 className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-ink">{childName}'s fees are paid up</p>
          {upcoming ? (
            <p className="mt-1 text-[13.5px] text-ink-2">
              Next is {upcoming.label} ({upcoming.covers}) — <span className="tnum font-medium text-ink">{rupees(upcoming.amount)}</span>, due {fmtDate(upcoming.due)}. We'll send the invoice on {fmtDay(invoiceDate(upcoming.due))} and remind you a week before it's due.
            </p>
          ) : (
            <p className="mt-1 text-[13.5px] text-ink-2">All four instalments for this year are paid. Thank you.</p>
          )}
          {lastPaid && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => onReceipt(lastPaid)}>
              <Download /> Receipt for {lastPaid.label}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function TimelineRow({ ins, last, onPay, onReceipt }: { ins: Instalment; last: boolean; onPay: () => void; onReceipt: () => void }) {
  const marker = {
    paid: "bg-brand text-white",
    due: "border-2 border-[#D9961F] bg-surface",
    overdue: "border-2 border-bad bg-surface",
    upcoming: "border border-line-strong bg-surface",
  }[ins.status];
  return (
    <li className="relative flex gap-3.5 pb-4 last:pb-1">
      {!last && <span className={cn("absolute top-6 bottom-0 left-[9px] w-px", ins.status === "paid" ? "bg-brand/40" : "bg-line-strong")} aria-hidden />}
      <span className={cn("relative mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", marker)}>{ins.status === "paid" && <Check className="size-3" strokeWidth={3} />}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-ink">
            {ins.label} <span className="font-normal text-muted">· {ins.covers}</span>
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {ins.status === "paid"
              ? `Paid ${fmtDate(ins.paidOn!)} · ${ins.mode}`
              : ins.status === "upcoming"
                ? `Due ${fmtDate(ins.due)} · invoice on ${fmtDay(invoiceDate(ins.due))}`
                : `Due ${fmtDate(ins.due)}${ins.status === "overdue" ? " · overdue" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className={cn("tnum text-[13.5px] font-semibold", ins.status === "upcoming" ? "text-muted" : "text-ink")}>{rupees(ins.amount)}</span>
          {ins.status === "paid" ? (
            <Button size="sm" variant="ghost" onClick={onReceipt} aria-label={`Receipt for ${ins.label}`}>
              Receipt
            </Button>
          ) : ins.status === "due" || ins.status === "overdue" ? (
            <Button size="sm" variant="primary" onClick={onPay}>
              Pay
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
