"use client";

import { Printer, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Crest } from "@/components/shell/Crest";
import { Dialog } from "@/components/ui/overlay";
import { Button, cn } from "@/components/ui/primitives";
import { academicYear } from "@/lib/data/calendar";
import { classLabel, GRADE_BY_ID } from "@/lib/data/school";
import { fmtDate, fmtTime, rupees } from "@/lib/format";
import { useBrand } from "@/lib/session";
import { amountInWords, type ReceiptData } from "./lib";

/** The fee receipt as a document: used on screen inside sheets and on paper. */
export function ReceiptDocument({ data, className }: { data: ReceiptData; className?: string }) {
  const brand = useBrand();
  const { student: s, instalment: ins } = data;
  const ay = academicYear(ins.due);
  const payer = s.guardians[0];
  const rows: { label: string; note?: string; amount: number }[] = [
    { label: `Tuition fee`, note: `${ins.label} · ${ins.covers}`, amount: ins.tuition },
    ...(ins.transport ? [{ label: "Transport fee", note: s.routeId ? `Route ${s.routeId}` : undefined, amount: ins.transport }] : []),
    ...(ins.concession ? [{ label: `${s.concession?.label ?? ""} concession`, note: s.concession ? `${s.concession.pct}% of tuition` : undefined, amount: -ins.concession }] : []),
    ...(ins.lateFee ? [{ label: "Late fee", note: "Paid after the 15-day grace period", amount: ins.lateFee }] : []),
  ];

  return (
    <article className={cn("@container relative overflow-hidden rounded-xl border border-line bg-surface text-ink", className)} aria-label={`Fee receipt ${data.receipt}`}>
      <div className="h-1 bg-brand" aria-hidden />
      <div className="px-5 pt-5 pb-6 @md:px-7">
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Crest size={40} />
            <div className="min-w-0">
              <p className="title-serif text-[16px] leading-tight font-semibold">{brand.school}</p>
              <p className="mt-0.5 text-[11.5px] text-muted">{brand.city}, Haryana · Affiliated to CBSE, New Delhi</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">Fee receipt</p>
            <p className="tnum mt-1 text-[12.5px] font-semibold">{data.receipt}</p>
          </div>
        </header>

        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 border-y border-line py-4 text-[12.5px] @lg:grid-cols-2">
          <Meta k="Received from" v={`${payer.relation === "Mother" ? "Mrs." : "Mr."} ${payer.name} (${payer.relation.toLowerCase()})`} />
          <Meta k="Date" v={data.at ? `${fmtDate(data.paidOn)}, ${fmtTime(data.at)}` : fmtDate(data.paidOn)} />
          <Meta k="Student" v={`${s.name} · ${GRADE_BY_ID[s.grade].label} ${s.section}`} />
          <Meta k="Admission no." v={s.admissionNo} />
          <Meta k="Academic year" v={ay.label} />
          <Meta k="Class · roll" v={`${classLabel(s.grade, s.section)} · ${s.roll}`} />
        </dl>

        <table className="mt-4 w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] font-semibold tracking-[0.04em] text-muted uppercase">
              <th className="pb-2 font-semibold">Particulars</th>
              <th className="pb-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <td className="py-2.5 pr-3">
                  <span className="text-ink">{r.label}</span>
                  {r.note && <span className="block text-[11.5px] text-muted">{r.note}</span>}
                </td>
                <td className="tnum py-2.5 text-right align-top whitespace-nowrap">{r.amount < 0 ? `−${rupees(-r.amount)}` : rupees(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink/80">
              <td className="pt-3 font-semibold">Total received</td>
              <td className="tnum pt-3 text-right text-[15px] font-semibold whitespace-nowrap">{rupees(ins.amount)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-1.5 text-[11.5px] text-muted italic">{amountInWords(ins.amount)}</p>

        <div className="mt-5 flex items-end justify-between gap-4">
          <dl className="space-y-1 text-[12px]">
            <div className="flex gap-2">
              <dt className="w-[92px] shrink-0 text-muted">Paid by</dt>
              <dd className="font-medium">{data.mode}</dd>
            </div>
            {data.reference && (
              <div className="flex gap-2">
                <dt className="w-[92px] shrink-0 text-muted">Reference</dt>
                <dd className="tnum font-medium">{data.reference}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-[92px] shrink-0 text-muted">Collected by</dt>
              <dd className="font-medium">{data.source === "parent" ? "Online · parent app" : data.mode === "Cash" || data.mode === "Cheque" ? "Accounts office" : "Online payment"}</dd>
            </div>
          </dl>
          <div
            className="shrink-0 -rotate-6 rounded-md border-2 border-good/70 px-3 py-1 text-center text-good"
            aria-label="Paid"
          >
            <p className="text-[13px] leading-none font-bold tracking-[0.18em]">PAID</p>
            <p className="tnum mt-1 text-[9.5px] leading-none font-semibold tracking-[0.04em]">{fmtDate(data.paidOn).toUpperCase()}</p>
          </div>
        </div>

        <p className="mt-6 border-t border-dashed border-line-strong pt-3 text-[10.5px] leading-relaxed text-muted">
          Computer-generated receipt; no signature required. Tuition is exempt from GST. Keep this receipt for income-tax deduction under Section 80C. Queries: accounts@amaltas.edu.in
        </p>
      </div>
    </article>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="w-[100px] shrink-0 text-muted">{k}</dt>
      <dd className="min-w-0 font-medium text-ink">{v}</dd>
    </div>
  );
}

/**
 * Renders the receipt into a print-only layer and opens the browser's print
 * dialog (Save as PDF works as "Download").
 */
export function PrintReceiptButton({ data, variant = "primary", size = "md", label = "Print / save PDF", className }: { data: ReceiptData; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg"; label?: string; className?: string }) {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setPrinting(true)}>
        <Printer /> {label}
      </Button>
      {printing && <PrintLayer data={data} />}
    </>
  );
}

export function PrintLayer({ data }: { data: ReceiptData }) {
  return createPortal(
    <div className="kaksha-print-layer">
      <style>{`
        @media screen { .kaksha-print-layer { display: none; } }
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          body > *:not(.kaksha-print-layer) { display: none !important; }
          .kaksha-print-layer { display: block !important; }
          .kaksha-print-layer article { border: 1px solid #d6d3ca; max-width: 168mm; margin: 0 auto; box-shadow: none; }
          .kaksha-print-layer * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <ReceiptDocument data={data} />
    </div>,
    document.body,
  );
}

/** Right-hand sheet showing one receipt with print + resend actions. */
export function ReceiptSheet({ data, open, onClose, onResend }: { data: ReceiptData | null; open: boolean; onClose: () => void; onResend?: () => void }) {
  return (
    <Dialog
      open={open && !!data}
      onClose={onClose}
      side
      title={data ? `Receipt ${data.receipt}` : "Receipt"}
      description={data ? `${data.student.name} · ${data.instalment.label} (${data.instalment.covers})` : undefined}
      footer={
        data && (
          <>
            {onResend && (
              <Button variant="secondary" onClick={onResend}>
                <Send /> Send to parent
              </Button>
            )}
            <PrintReceiptButton data={data} />
          </>
        )
      }
    >
      {data && <ReceiptDocument data={data} className="shadow-[var(--shadow-card)]" />}
    </Dialog>
  );
}
