"use client";

import { ArrowLeft, Check, IndianRupee } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Field, Input, SearchInput, Select } from "@/components/ui/forms";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, cn } from "@/components/ui/primitives";
import { feeAccount, ledger, type Instalment, type PaymentMode } from "@/lib/data/fees";
import { students, type Student } from "@/lib/data/people";
import { classLabel } from "@/lib/data/school";
import { fmtDay, number, rupees } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { invoiceDate, recordPayment } from "./lib";

const OFFICE_MODES: { value: PaymentMode; label: string; ref: string; placeholder: string; required: boolean }[] = [
  { value: "Cash", label: "Cash", ref: "Cash memo no.", placeholder: "Optional", required: false },
  { value: "Cheque", label: "Cheque", ref: "Cheque no. and bank", placeholder: "e.g. 004512 · Punjab & Sind Bank", required: true },
  { value: "UPI", label: "UPI (counter QR)", ref: "UPI transaction ID (UTR)", placeholder: "12-digit UTR", required: true },
  { value: "Card", label: "Card (POS machine)", ref: "Approval code", placeholder: "6-digit code on the charge slip", required: true },
  { value: "Net banking", label: "Bank transfer (NEFT/IMPS)", ref: "Bank reference no.", placeholder: "As shown in the bank statement", required: true },
];

export function RecordPaymentDialog({
  open,
  onClose,
  initialStudent,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  initialStudent?: Student | null;
  onRecorded?: (student: Student, instalmentId: string) => void;
}) {
  const toast = useToast();
  const payments = useAppState((s) => s.payments);
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [insId, setInsId] = useState<string | null>(null);
  const [mode, setMode] = useState<PaymentMode>("Cash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  // reset whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setStudent(initialStudent ?? null);
    setMode("Cash");
    setReference("");
    setTried(false);
    setSaving(false);
  }, [open, initialStudent]);

  const account = useMemo(() => (student ? feeAccount(student) : null), [student, payments]);

  // pick the most pressing open instalment by default
  useEffect(() => {
    if (!account) return;
    const first = account.instalments.find((i) => i.status === "overdue") ?? account.instalments.find((i) => i.status === "due") ?? null;
    setInsId(first?.id ?? null);
    setAmount(first ? String(first.amount) : "");
  }, [account]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ledger().defaulters.slice(0, 5).map((a) => a.student);
    return students()
      .filter((s) => s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q) || classLabel(s.grade, s.section).toLowerCase() === q || s.guardians.some((g) => g.name.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [query, payments]);

  const ins = account?.instalments.find((i) => i.id === insId) ?? null;
  const modeDef = OFFICE_MODES.find((m) => m.value === mode)!;
  const amt = Number(amount.replace(/[^\d]/g, ""));
  const amountError = !ins ? null : !amt ? "Enter the amount received" : amt < ins.amount ? `Part payments aren't accepted — collect ${rupees(ins.amount)} for ${ins.label}.` : amt > ins.amount ? `That's more than the instalment. Collect exactly ${rupees(ins.amount)}.` : null;
  const refError = modeDef.required && reference.trim().length < 4 ? `Enter the ${modeDef.ref.toLowerCase()}` : null;

  const submit = () => {
    setTried(true);
    if (!student || !ins || amountError || refError) return;
    setSaving(true);
    setTimeout(() => {
      const { receipt } = recordPayment({ student, instalment: ins, mode, reference: reference.trim(), source: "office" });
      toast({ title: `Receipt ${receipt} issued`, body: `${rupees(ins.amount)} from ${student.name} (${classLabel(student.grade, student.section)}) for ${ins.label} · ${mode}` });
      setSaving(false);
      onClose();
      onRecorded?.(student, ins.id);
    }, 550);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record a payment"
      description="For fees received at the accounts office — cash, cheque, card or a bank transfer."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!student || !ins} loading={saving}>
            {ins ? `Record ${rupees(ins.amount)}` : "Record payment"}
          </Button>
        </>
      }
    >
      {!student ? (
        <div>
          <SearchInput value={query} onChange={setQuery} placeholder="Student, parent or admission no." autoFocus />
          <p className="mt-4 mb-1.5 text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">{query ? `${number(results.length)} ${results.length === 1 ? "match" : "matches"}` : "Largest overdue accounts"}</p>
          <ul className="-mx-2">
            {results.map((s) => (
              <StudentOption key={s.id} student={s} onPick={() => setStudent(s)} />
            ))}
            {results.length === 0 && <li className="px-2 py-6 text-center text-[13px] text-muted">No student matches “{query}”. Try the admission number.</li>}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-3">
            <Avatar name={student.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold">{student.name}</p>
              <p className="truncate text-[12px] text-muted">
                {classLabel(student.grade, student.section)} · {student.admissionNo} · {student.guardians[0].name}
              </p>
            </div>
            {!initialStudent && (
              <Button size="sm" variant="ghost" onClick={() => setStudent(null)}>
                <ArrowLeft /> Change
              </Button>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 text-[12.5px] font-medium text-ink-2">Instalment</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {account!.instalments.map((i) => (
                <InstalmentOption key={i.id} ins={i} selected={i.id === insId} onPick={() => {
                  setInsId(i.id);
                  setAmount(String(i.amount));
                }} />
              ))}
            </div>
            {!ins && <p className="mt-2 text-[12px] text-muted">Nothing is due on this account right now. Upcoming instalments can be collected once their invoice goes out.</p>}
          </fieldset>

          {ins && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Mode" htmlFor="rp-mode">
                <Select id="rp-mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className="w-full">
                  {OFFICE_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount received" htmlFor="rp-amount" error={tried ? amountError : null} hint={ins.lateFee ? `Includes ${rupees(ins.lateFee)} late fee` : undefined}>
                <div className="relative">
                  <IndianRupee className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
                  <Input id="rp-amount" inputMode="numeric" value={amount ? number(amt) : ""} onChange={(e) => setAmount(e.target.value)} className="tnum pl-7" />
                </div>
              </Field>
              <Field label={modeDef.ref} htmlFor="rp-ref" error={tried ? refError : null} className="sm:col-span-2">
                <Input id="rp-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={modeDef.placeholder} />
              </Field>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function StudentOption({ student: s, onPick }: { student: Student; onPick: () => void }) {
  const acc = feeAccount(s);
  return (
    <li>
      <button type="button" onClick={onPick} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-ink/[0.045]">
        <Avatar name={s.name} size={30} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{s.name}</span>
          <span className="block truncate text-[12px] text-muted">
            {classLabel(s.grade, s.section)} · {s.admissionNo}
          </span>
        </span>
        {acc.overdue > 0 ? (
          <span className="tnum text-[12.5px] font-semibold text-bad">{rupees(acc.overdue)} overdue</span>
        ) : acc.outstanding > 0 ? (
          <span className="tnum text-[12.5px] font-medium text-ink-2">{rupees(acc.outstanding)} due</span>
        ) : (
          <span className="text-[12px] text-muted">Paid up</span>
        )}
      </button>
    </li>
  );
}

function InstalmentOption({ ins, selected, onPick }: { ins: Instalment; selected: boolean; onPick: () => void }) {
  const payable = ins.status === "due" || ins.status === "overdue";
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors",
        !payable && "cursor-not-allowed bg-surface-2",
        selected ? "border-brand bg-brand-soft/40 ring-[3px] ring-[color-mix(in_oklab,var(--brand)_14%,transparent)]" : "border-line hover:border-line-strong",
      )}
    >
      <input type="radio" name="rp-ins" className="sr-only" checked={selected} disabled={!payable} onChange={onPick} />
      <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", selected ? "border-brand bg-brand text-white" : "border-line-strong bg-surface")}>
        {selected && <Check className="size-2.5" strokeWidth={3.5} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className={cn("text-[13px] font-medium", !payable && "text-muted")}>
            {ins.label} <span className="font-normal text-muted">· {ins.covers}</span>
          </span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-2 text-[12px]">
          <span className="text-muted">
            {ins.status === "paid" ? `Paid ${fmtDay(ins.paidOn!)}` : ins.status === "upcoming" ? `Invoice on ${fmtDay(invoiceDate(ins.due))}` : `Due ${fmtDay(ins.due)}`}
          </span>
          {ins.status === "overdue" ? (
            <Badge tone="bad">{rupees(ins.amount)}</Badge>
          ) : ins.status === "due" ? (
            <span className="tnum font-semibold text-ink">{rupees(ins.amount)}</span>
          ) : ins.status === "paid" ? (
            <Badge tone="good">Paid</Badge>
          ) : (
            <span className="tnum text-muted">{rupees(ins.amount)}</span>
          )}
        </span>
      </span>
    </label>
  );
}
