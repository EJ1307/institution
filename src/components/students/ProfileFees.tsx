"use client";

import { BellRing, Printer, ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";
import { Crest } from "@/components/shell/Crest";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, cn } from "@/components/ui/primitives";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { academicYear, isoDate } from "@/lib/data/calendar";
import { feeAccount, LATE_FEE, type Instalment } from "@/lib/data/fees";
import type { Student } from "@/lib/data/people";
import { classLabel } from "@/lib/data/school";
import { fmtDate, fmtDay, rupees } from "@/lib/format";
import { useBrand } from "@/lib/session";
import { setState, useAppState } from "@/lib/store";
import { SummaryCell, SummaryStrip } from "./shared";

const STATUS: Record<Instalment["status"], { label: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  paid: { label: "Paid", tone: "good" },
  due: { label: "Due", tone: "warn" },
  overdue: { label: "Overdue", tone: "bad" },
  upcoming: { label: "Not billed yet", tone: "neutral" },
};

export function ProfileFees({ student: s }: { student: Student }) {
  const toast = useToast();
  const payments = useAppState((st) => st.payments);
  const reminders = useAppState((st) => st.reminders);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const acc = useMemo(() => feeAccount(s), [s, payments]);
  const [receipt, setReceipt] = useState<Instalment | null>(null);
  const ay = academicYear();
  const reminded = reminders[s.id];
  const remindedToday = reminded && isoDate(new Date(reminded)) === isoDate(new Date());
  const concessionYear = acc.instalments.reduce((a, i) => a + i.concession, 0);

  const remind = () => {
    setState((st) => ({ reminders: { ...st.reminders, [s.id]: new Date().toISOString() } }));
    toast({ title: "Fee reminder sent", body: `${s.guardians[0].name} will get an SMS and an app notification with a payment link for ${rupees(acc.outstanding)}.` });
  };

  return (
    <div className="flex flex-col gap-4">
      <SummaryStrip className="grid-cols-2 lg:grid-cols-4">
        <SummaryCell label={`Annual fee · ${ay.label}`} value={rupees(acc.annual)} sub={`${classLabel(s.grade, s.section)} tuition${s.routeId ? " + bus" : ""}, 4 instalments`} />
        <SummaryCell label="Paid so far" value={rupees(acc.paid)} sub={`${acc.instalments.filter((i) => i.status === "paid").length} of 4 instalments`} />
        <SummaryCell
          label="Outstanding"
          value={<span className={acc.overdue ? "text-bad" : undefined}>{rupees(acc.outstanding)}</span>}
          sub={acc.overdue ? `${rupees(acc.overdue)} past its due date` : acc.outstanding ? `due ${fmtDay(acc.nextDue!.due)}` : "nothing due"}
        />
        <SummaryCell label="Concession" value={s.concession ? `${s.concession.pct}%` : "None"} sub={s.concession ? `${s.concession.label} · ${rupees(concessionYear)} a year` : "Full fee applies"} />
      </SummaryStrip>

      <Card>
        <CardHeader
          title="Instalment ledger"
          description={`Quarterly invoices go out 25 days before the due date · ${rupees(LATE_FEE)} late fee after 15 days`}
          action={
            acc.outstanding > 0 ? (
              <Button size="sm" variant={remindedToday ? "ghost" : "secondary"} onClick={remind} disabled={!!remindedToday}>
                <BellRing /> {remindedToday ? "Reminder sent today" : "Send reminder"}
              </Button>
            ) : undefined
          }
        />
        <Table>
          <THead>
            <tr>
              <Th>Instalment</Th>
              <Th>Due</Th>
              <Th align="right" className="hidden lg:table-cell">
                Tuition
              </Th>
              <Th align="right" className="hidden lg:table-cell">
                Transport
              </Th>
              <Th align="right" className="hidden lg:table-cell">
                Concession
              </Th>
              <Th align="right" className="hidden md:table-cell">
                Late fee
              </Th>
              <Th align="right">Amount</Th>
              <Th>Status</Th>
              <Th className="hidden md:table-cell">Paid</Th>
              <Th>
                <span className="sr-only">Receipt</span>
              </Th>
            </tr>
          </THead>
          <tbody>
            {acc.instalments.map((i) => (
              <Tr key={i.id}>
                <Td>
                  <span className="font-medium text-ink">{i.label}</span>
                  <span className="block text-[12px] text-muted">{i.covers}</span>
                </Td>
                <Td className="tnum whitespace-nowrap text-ink-2">{fmtDay(i.due)}</Td>
                <Td align="right" className="hidden lg:table-cell">
                  {rupees(i.tuition)}
                </Td>
                <Td align="right" className="hidden text-ink-2 lg:table-cell">
                  {i.transport ? rupees(i.transport) : "—"}
                </Td>
                <Td align="right" className="hidden text-ink-2 lg:table-cell">
                  {i.concession ? `−${rupees(i.concession)}` : "—"}
                </Td>
                <Td align="right" className={cn("hidden md:table-cell", i.lateFee ? "text-bad" : "text-ink-2")}>
                  {i.lateFee ? rupees(i.lateFee) : "—"}
                </Td>
                <Td align="right" className="font-semibold text-ink">
                  {rupees(i.amount)}
                </Td>
                <Td>
                  <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>
                </Td>
                <Td className="hidden md:table-cell">
                  {i.paidOn ? (
                    <>
                      <span className="tnum text-ink-2">{fmtDay(i.paidOn)}</span>
                      <span className="block text-[12px] text-muted">{i.mode}</span>
                    </>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </Td>
                <Td align="right">
                  {i.receipt ? (
                    <Button size="sm" variant="ghost" onClick={() => setReceipt(i)} aria-label={`Receipt for ${i.label}`}>
                      <ReceiptText /> <span className="hidden sm:inline">Receipt</span>
                    </Button>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-surface-2 text-[13px]">
              <td className="h-11 pl-5 font-semibold text-ink" colSpan={2}>
                Total for the year
              </td>
              <td className="hidden lg:table-cell" colSpan={3} />
              <td className="hidden md:table-cell" />
              <td className="tnum px-3 text-right font-semibold text-ink">{rupees(acc.instalments.reduce((a, i) => a + i.amount, 0))}</td>
              <td colSpan={3} className="pr-5 text-[12px] text-muted">
                {rupees(acc.paid)} received
              </td>
            </tr>
          </tfoot>
        </Table>
      </Card>

      <ReceiptDialog student={s} ins={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

function ReceiptDialog({ student: s, ins, onClose }: { student: Student; ins: Instalment | null; onClose: () => void }) {
  const brand = useBrand();
  const toast = useToast();
  const ay = academicYear();
  const lines = ins
    ? [
        { k: `Tuition fee · ${ins.covers}`, v: ins.tuition },
        ...(ins.transport ? [{ k: `Transport · Bus ${s.routeId}`, v: ins.transport }] : []),
        ...(ins.concession ? [{ k: `${s.concession?.label} concession (${s.concession?.pct}%)`, v: -ins.concession }] : []),
        ...(ins.lateFee ? [{ k: "Late fee", v: ins.lateFee }] : []),
      ]
    : [];
  return (
    <Dialog
      open={!!ins}
      onClose={onClose}
      title="Fee receipt"
      description={ins?.receipt ?? ""}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              toast({ title: "Receipt emailed", body: `A copy was sent to the email registered for ${s.guardians[0].name}.`, tone: "info" });
              onClose();
            }}
          >
            Email to parent
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        </>
      }
    >
      {ins && (
        <div id="receipt-print" className="rounded-xl border border-line bg-white p-5 text-[12.5px] text-[#17191C]">
          <style>{`
            @media print {
              body * { visibility: hidden !important; }
              dialog::backdrop { background: transparent !important; }
              #receipt-print, #receipt-print * { visibility: visible !important; }
              #receipt-print { position: fixed; left: 0; top: 0; width: 520px; border: 0; }
            }
          `}</style>
          <div className="flex items-start justify-between gap-4 border-b border-[#E7E5DE] pb-4">
            <div className="flex items-center gap-3">
              <Crest size={36} />
              <div>
                <div className="title-serif text-[14px] font-semibold">{brand.school}</div>
                <div className="text-[11px] text-[#777B81]">{brand.city} · Affiliated to CBSE</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10.5px] font-semibold tracking-[0.1em] text-[#777B81] uppercase">Receipt</div>
              <div className="tnum font-medium">{ins.receipt}</div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 py-4">
            <div>
              <dt className="text-[11px] text-[#777B81]">Received from</dt>
              <dd className="font-medium">{s.guardians[0].name}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#777B81]">Date</dt>
              <dd className="tnum font-medium">{ins.paidOn ? fmtDate(ins.paidOn) : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#777B81]">Student</dt>
              <dd className="font-medium">
                {s.name} · {classLabel(s.grade, s.section)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#777B81]">Admission no.</dt>
              <dd className="tnum font-medium">{s.admissionNo}</dd>
            </div>
          </dl>
          <table className="w-full border-t border-[#E7E5DE]">
            <tbody>
              {lines.map((l) => (
                <tr key={l.k} className="border-b border-[#EEECE6]">
                  <td className="py-2">{l.k}</td>
                  <td className="tnum py-2 text-right">{l.v < 0 ? `−${rupees(-l.v)}` : rupees(l.v)}</td>
                </tr>
              ))}
              <tr>
                <td className="pt-3 font-semibold">Total paid</td>
                <td className="tnum pt-3 text-right text-[15px] font-semibold">{rupees(ins.amount)}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 flex items-end justify-between gap-4 rounded-lg bg-[#F6F5F1] px-3 py-2.5 text-[11.5px] text-[#464A50]">
            <span>
              Paid by {ins.mode} · {ins.label}, AY {ay.label}
              <br />
              <span className="text-[#777B81]">Computer-generated receipt; no signature required.</span>
            </span>
            <span className="tnum shrink-0 text-[#777B81]">{ins.paidOn ? isoDate(ins.paidOn) : ""}</span>
          </div>
        </div>
      )}
    </Dialog>
  );
}

