"use client";

import { Check, CheckCircle2, ChevronDown, CreditCard, Landmark, Loader2, Lock, QrCode, Smartphone } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Crest } from "@/components/shell/Crest";
import { Checkbox, Field, Input, SearchInput, Segmented, Select } from "@/components/ui/forms";
import { Dialog } from "@/components/ui/overlay";
import { Button, cn } from "@/components/ui/primitives";
import type { Instalment, PaymentMode } from "@/lib/data/fees";
import type { Student } from "@/lib/data/people";
import { hashInt } from "@/lib/rng";
import { fmtDay, fmtTime, rupees } from "@/lib/format";
import { PrintReceiptButton } from "./Receipt";
import { makeReference, receiptFor, recordPayment, type ReceiptData } from "./lib";

type Method = "upi" | "card" | "netbanking";
type Step = "choose" | "processing" | "done";

const BANKS = [
  { id: "sbi", name: "State Bank of India", mono: "SBI" },
  { id: "hdfc", name: "HDFC Bank", mono: "HD" },
  { id: "icici", name: "ICICI Bank", mono: "IC" },
  { id: "axis", name: "Axis Bank", mono: "AX" },
  { id: "kotak", name: "Kotak Mahindra Bank", mono: "KM" },
  { id: "pnb", name: "Punjab National Bank", mono: "PN" },
];
const OTHER_BANKS = ["Bank of Baroda", "Canara Bank", "Federal Bank", "IDFC FIRST Bank", "IndusInd Bank", "Union Bank of India", "Yes Bank"];

const PAYEE_VPA = "amaltasschool@upi";

export function PaySheet({
  open,
  onClose,
  student,
  instalment,
}: {
  open: boolean;
  onClose: () => void;
  student: Student;
  instalment: Instalment | null;
}) {
  const [step, setStep] = useState<Step>("choose");
  const [method, setMethod] = useState<Method>("upi");
  const [upiMode, setUpiMode] = useState<"qr" | "id">("id");
  const [vpa, setVpa] = useState("");
  const [vpaChecked, setVpaChecked] = useState<null | "checking" | "ok">(null);
  const [card, setCard] = useState({ number: "", name: "", exp: "", cvv: "", save: true });
  const [bank, setBank] = useState<string | null>(null);
  const [bankQuery, setBankQuery] = useState("");
  const [tried, setTried] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [progress, setProgress] = useState(0);
  const payingRef = useRef<{ mode: PaymentMode; ins: Instalment; last4?: string } | null>(null);

  // reset on open; QR first on wide screens, UPI ID on phones
  useEffect(() => {
    if (!open) return;
    setStep("choose");
    setMethod("upi");
    setUpiMode(window.matchMedia("(min-width: 640px)").matches ? "qr" : "id");
    setVpa("");
    setVpaChecked(null);
    setCard({ number: "", name: "", exp: "", cvv: "", save: true });
    setBank(null);
    setBankQuery("");
    setTried(false);
    setReceipt(null);
    setProgress(0);
  }, [open]);

  const ins = instalment;
  const amount = ins?.amount ?? 0;
  const payer = student.guardians.find((g) => g.relation === "Father") ?? student.guardians[0];
  const savedVpa = `${payer.name.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".")}@upi`;

  // ——— validation ———
  const digits = card.number.replace(/\D/g, "");
  const [mm, yy] = card.exp.split("/").map((x) => Number(x?.trim()));
  const now = new Date();
  const expValid = mm >= 1 && mm <= 12 && !!yy && (2000 + yy > now.getFullYear() || (2000 + yy === now.getFullYear() && mm >= now.getMonth() + 1));
  const cardErrors = {
    number: digits.length < 15 ? "Enter the 16-digit card number" : null,
    name: card.name.trim().length < 3 ? "Enter the name as printed on the card" : null,
    exp: !expValid ? "Use MM / YY" : null,
    cvv: card.cvv.length < 3 ? "3 digits on the back" : null,
  };
  const vpaValid = /^[a-z0-9._-]{2,}@[a-z]{2,}$/i.test(vpa.trim());

  const canPay =
    method === "upi" ? (upiMode === "id" ? vpaChecked === "ok" : false) : method === "card" ? Object.values(cardErrors).every((e) => !e) : !!bank;

  const start = (mode: PaymentMode) => {
    if (!ins) return;
    payingRef.current = { mode, ins, last4: mode === "Card" ? digits.slice(-4) : undefined };
    setStep("processing");
    setProgress(0);
  };

  // processing → success: staged so it reads like a real gateway round-trip
  useEffect(() => {
    if (step !== "processing") return;
    const timers = [
      setTimeout(() => setProgress(1), 900),
      setTimeout(() => setProgress(2), method === "upi" && upiMode === "id" ? 3200 : 2200),
      setTimeout(() => {
        const p = payingRef.current;
        if (!p) return;
        const ref = makeReference(p.mode, student.id + p.ins.id);
        recordPayment({ student, instalment: p.ins, mode: p.mode, reference: p.last4 ? `•••• ${p.last4} · ${ref}` : ref, source: "parent" });
        setReceipt(receiptFor(student, p.ins.id));
        setStep("done");
      }, method === "upi" && upiMode === "id" ? 4000 : 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [step, method, upiMode, student]);

  // QR: payment is "detected" a few seconds after the code is shown
  useEffect(() => {
    if (!open || step !== "choose" || method !== "upi" || upiMode !== "qr") return;
    const id = setTimeout(() => start("UPI"), 9000);
    return () => clearTimeout(id);
  }, [open, step, method, upiMode]);

  const pay = () => {
    setTried(true);
    if (!canPay) return;
    start(method === "upi" ? "UPI" : method === "card" ? "Card" : "Net banking");
  };

  const close = () => {
    if (step === "processing") return; // don't abandon a payment mid-way
    onClose();
  };

  const title = step === "done" ? "Payment successful" : step === "processing" ? "Processing payment" : `Pay ${rupees(amount)}`;
  const description = ins ? `${ins.label} · ${ins.covers} · ${student.name}` : undefined;

  return (
    <Dialog
      open={open && !!ins}
      onClose={close}
      side
      title={title}
      description={description}
      footer={
        step === "choose" ? (
          method === "upi" && upiMode === "qr" ? (
            <p className="mr-auto flex items-center gap-2 text-[12.5px] text-muted">
              <Loader2 className="size-3.5 animate-spin" /> Waiting for you to scan and pay…
            </p>
          ) : (
            <div className="flex w-full flex-col gap-2">
              <Button variant="primary" size="lg" className="w-full" onClick={pay} disabled={tried && !canPay}>
                <Lock /> {method === "netbanking" ? `Continue to ${bank ?? "your bank"}` : method === "upi" ? `Send request · ${rupees(amount)}` : `Pay ${rupees(amount)}`}
              </Button>
            </div>
          )
        ) : step === "done" && receipt ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <PrintReceiptButton data={receipt} variant="secondary" label="Download receipt" className="w-full sm:w-auto" />
            <Button variant="primary" onClick={onClose} className="w-full sm:w-auto">
              Done
            </Button>
          </div>
        ) : undefined
      }
    >
      {ins && step === "choose" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] text-muted">Paying</p>
                <p className="truncate text-[13.5px] font-medium">Amaltas International School</p>
              </div>
              <p className="tnum shrink-0 text-[22px] font-semibold tracking-[-0.02em]">{rupees(amount)}</p>
            </div>
            <p className="mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-[11.5px] text-muted">
              <Lock className="size-3" aria-hidden /> Encrypted end to end. Card and bank details never reach the school.
            </p>
          </div>

          <div role="radiogroup" aria-label="Payment method" className="flex flex-col overflow-hidden rounded-xl border border-line">
            <MethodRow
              icon={<Smartphone />}
              title="UPI"
              sub="Any UPI app · instant · no charges"
              active={method === "upi"}
              onSelect={() => {
                setMethod("upi");
                setTried(false);
              }}
            >
              <Segmented
                size="sm"
                label="UPI option"
                value={upiMode}
                onChange={setUpiMode}
                options={[
                  { value: "id", label: "UPI ID" },
                  { value: "qr", label: "Scan QR" },
                ]}
              />
              {upiMode === "qr" ? (
                <div className="mt-4 flex flex-col items-center text-center">
                  <StylisedQR seed={`${student.id}${ins.id}`} />
                  <p className="mt-3 text-[13px] font-medium">Scan with any UPI app</p>
                  <p className="tnum mt-0.5 text-[12px] text-muted">
                    {PAYEE_VPA} · {rupees(amount)}
                  </p>
                  <QrTimer />
                </div>
              ) : (
                <div className="mt-4">
                  <Field label="Your UPI ID" htmlFor="pay-vpa" error={tried && vpaChecked !== "ok" ? (vpaValid ? "Verify your UPI ID to continue" : "Enter a UPI ID like name@bank") : null}>
                    <div className="flex gap-2">
                      <Input
                        id="pay-vpa"
                        value={vpa}
                        onChange={(e) => {
                          setVpa(e.target.value);
                          setVpaChecked(null);
                        }}
                        placeholder="name@bank"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        className="flex-1"
                      />
                      <Button
                        variant="secondary"
                        disabled={!vpaValid || vpaChecked !== null}
                        onClick={() => {
                          setVpaChecked("checking");
                          setTimeout(() => setVpaChecked("ok"), 700);
                        }}
                      >
                        {vpaChecked === "checking" ? <Loader2 className="animate-spin" /> : vpaChecked === "ok" ? <Check /> : null}
                        {vpaChecked === "ok" ? "Verified" : "Verify"}
                      </Button>
                    </div>
                  </Field>
                  {vpaChecked === "ok" ? (
                    <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-good">
                      <CheckCircle2 className="size-3.5" /> {payer.name}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setVpa(savedVpa);
                        setVpaChecked("ok");
                      }}
                      className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[12px] text-ink-2 hover:border-line-strong hover:bg-surface-2"
                    >
                      <span className="size-1.5 rounded-full bg-good" /> Use {savedVpa} · saved
                    </button>
                  )}
                  <p className="mt-3 text-[12px] leading-relaxed text-muted">You'll get a request in your UPI app. Approve it with your UPI PIN within 5 minutes.</p>
                </div>
              )}
            </MethodRow>

            <MethodRow
              icon={<CreditCard />}
              title="Debit or credit card"
              sub="All major networks · 3-D Secure"
              active={method === "card"}
              onSelect={() => {
                setMethod("card");
                setTried(false);
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Card number" htmlFor="pay-card" className="col-span-2" error={tried ? cardErrors.number : null}>
                  <Input
                    id="pay-card"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={card.number}
                    placeholder="0000 0000 0000 0000"
                    onChange={(e) => setCard((c) => ({ ...c, number: e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})(?=.)/g, "$1 ") }))}
                    className="tnum tracking-[0.04em]"
                  />
                </Field>
                <Field label="Name on card" htmlFor="pay-name" className="col-span-2" error={tried ? cardErrors.name : null}>
                  <Input id="pay-name" autoComplete="cc-name" value={card.name} onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))} placeholder="As printed on the card" />
                </Field>
                <Field label="Expiry" htmlFor="pay-exp" error={tried ? cardErrors.exp : null}>
                  <Input
                    id="pay-exp"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM / YY"
                    value={card.exp}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setCard((c) => ({ ...c, exp: d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d }));
                    }}
                    className="tnum"
                  />
                </Field>
                <Field label="CVV" htmlFor="pay-cvv" error={tried ? cardErrors.cvv : null}>
                  <Input id="pay-cvv" inputMode="numeric" autoComplete="cc-csc" type="password" placeholder="•••" value={card.cvv} onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))} className="tnum" />
                </Field>
                <Checkbox className="col-span-2 mt-1 text-[12.5px]" checked={card.save} onChange={(v) => setCard((c) => ({ ...c, save: v }))} label="Save this card as a secure token for next time" />
              </div>
            </MethodRow>

            <MethodRow
              icon={<Landmark />}
              title="Net banking"
              sub="60+ banks"
              active={method === "netbanking"}
              onSelect={() => {
                setMethod("netbanking");
                setTried(false);
              }}
            >
              <SearchInput value={bankQuery} onChange={setBankQuery} placeholder="Search your bank" />
              <BankGrid query={bankQuery} selected={bank} onPick={setBank} />
              <Select
                aria-label="Other banks"
                className="mt-3 w-full"
                value={OTHER_BANKS.includes(bank ?? "") ? bank! : ""}
                onChange={(e) => e.target.value && setBank(e.target.value)}
              >
                <option value="">Other banks…</option>
                {OTHER_BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
              {tried && !bank && <p className="mt-2 text-[12px] text-bad">Choose your bank to continue.</p>}
            </MethodRow>
          </div>

          <p className="text-[11.5px] leading-relaxed text-muted">
            Paying for {ins.label} ({ins.covers}). Fees once paid are adjusted against future instalments and are not refunded mid-year, as per the school's fee policy.
          </p>
        </div>
      )}

      {ins && step === "processing" && <Processing method={method} upiMode={upiMode} progress={progress} amount={amount} bank={bank} />}

      {ins && step === "done" && receipt && <Success receipt={receipt} />}
    </Dialog>
  );
}

function MethodRow({ icon, title, sub, active, onSelect, children }: { icon: ReactNode; title: string; sub: string; active: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <div className={cn("border-t border-line first:border-t-0", active && "bg-surface")}>
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={onSelect}
        className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors", !active && "hover:bg-surface-2")}
      >
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-[18px]", active ? "bg-brand-soft text-brand" : "bg-ink/[0.045] text-muted")}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-ink">{title}</span>
          <span className="block text-[12px] text-muted">{sub}</span>
        </span>
        <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-full border", active ? "border-brand bg-brand text-white" : "border-line-strong")}>
          {active ? <Check className="size-3" strokeWidth={3} /> : <ChevronDown className="size-3 text-transparent" />}
        </span>
      </button>
      {active && <div className="animate-fade-in px-4 pb-4">{children}</div>}
    </div>
  );
}

function BankGrid({ query, selected, onPick }: { query: string; selected: string | null; onPick: (b: string) => void }) {
  const q = query.trim().toLowerCase();
  const list = [...BANKS, ...OTHER_BANKS.map((n) => ({ id: n, name: n, mono: n.split(" ").map((w) => w[0]).join("").slice(0, 2) }))].filter((b) => !q || b.name.toLowerCase().includes(q));
  const shown = q ? list : BANKS;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {shown.map((b) => {
        const on = selected === b.name;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onPick(b.name)}
            aria-pressed={on}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-[12.5px] transition-colors",
              on ? "border-brand bg-brand-soft/50 text-ink" : "border-line text-ink-2 hover:border-line-strong",
            )}
          >
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-md text-[10px] font-semibold tracking-[0.02em]", on ? "bg-brand text-white" : "bg-ink/[0.06] text-ink-2")}>{b.mono}</span>
            <span className="min-w-0 leading-tight">{b.name}</span>
          </button>
        );
      })}
      {shown.length === 0 && <p className="col-span-2 py-3 text-center text-[12.5px] text-muted">No bank matches “{query}”.</p>}
    </div>
  );
}

function QrTimer() {
  const [left, setLeft] = useState(299);
  useEffect(() => {
    const id = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="tnum mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink/[0.045] px-2.5 py-1 text-[11.5px] text-muted">
      <QrCode className="size-3" aria-hidden /> Code valid for {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </p>
  );
}

/** A QR-like code: finder squares, timing rows and seeded modules, with the crest in the middle. */
function StylisedQR({ seed, size = 184 }: { seed: string; size?: number }) {
  const N = 29;
  const cells = useMemo(() => {
    const out: [number, number][] = [];
    const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    const inLogo = (x: number, y: number) => x >= 10 && x <= 18 && y >= 10 && y <= 18;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (inFinder(x, y) || inLogo(x, y)) continue;
        const timing = (y === 6 || x === 6) && (x + y) % 2 === 0;
        if (timing || hashInt(seed, x, y) % 100 < 47) out.push([x, y]);
      }
    return out;
  }, [seed]);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.6} fill="none" stroke="var(--ink)" strokeWidth={1} />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.8} fill="var(--ink)" />
    </g>
  );
  return (
    <div className="relative rounded-2xl border border-line bg-white p-3 shadow-[var(--shadow-card)]" style={{ width: size + 24, height: size + 24 }}>
      <svg viewBox={`0 0 ${N} ${N}`} width={size} height={size} role="img" aria-label="UPI payment code">
        {cells.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x + 0.1} y={y + 0.1} width={0.8} height={0.8} rx={0.28} fill="var(--ink)" />
        ))}
        {finder(0, 0)}
        {finder(N - 7, 0)}
        {finder(0, N - 7)}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="grid size-11 place-items-center rounded-xl bg-white">
          <Crest size={34} />
        </span>
      </div>
    </div>
  );
}

function Processing({ method, upiMode, progress, amount, bank }: { method: Method; upiMode: "qr" | "id"; progress: number; amount: number; bank: string | null }) {
  const steps =
    method === "upi"
      ? upiMode === "id"
        ? ["Payment request sent to your UPI app", "Approved with your UPI PIN", "Confirming with the school"]
        : ["Payment received from your UPI app", "Verified with the bank", "Confirming with the school"]
      : method === "card"
        ? ["Card details encrypted and sent", "Authorised by your bank (3-D Secure)", "Confirming with the school"]
        : [`Signed in to ${bank ?? "your bank"}`, "Payment authorised", "Confirming with the school"];
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center px-2 text-center">
      <div className="relative grid size-16 place-items-center">
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-brand-soft border-t-brand" style={{ animationDuration: "1.1s" }} />
        <Lock className="size-5 text-brand" />
      </div>
      <p className="tnum mt-5 text-[22px] font-semibold tracking-[-0.02em]">{rupees(amount)}</p>
      <p className="mt-1 text-[13px] text-muted">
        {method === "upi" && upiMode === "id" ? "Open your UPI app and approve the request" : "Please don't close this window or press back"}
      </p>
      <ol className="mt-7 w-full max-w-[300px] space-y-3 text-left">
        {steps.map((s, i) => {
          const done = progress > i;
          const current = progress === i;
          return (
            <li key={s} className={cn("flex items-center gap-3 text-[13px] transition-colors", done ? "text-ink" : current ? "text-ink-2" : "text-faint")}>
              <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", done ? "bg-good text-white" : current ? "border border-brand" : "border border-line-strong")}>
                {done ? <Check className="size-3" strokeWidth={3} /> : current ? <Loader2 className="size-3 animate-spin text-brand" /> : null}
              </span>
              {s}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Success({ receipt }: { receipt: ReceiptData }) {
  const g = receipt.student.guardians[0];
  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <span className="animate-pop-in grid size-16 place-items-center rounded-full bg-good-soft">
        <span className="grid size-11 place-items-center rounded-full bg-good text-white">
          <Check className="size-6" strokeWidth={3} />
        </span>
      </span>
      <p className="tnum mt-5 text-[28px] leading-none font-semibold tracking-[-0.02em]">{rupees(receipt.instalment.amount)}</p>
      <p className="mt-2 text-[13.5px] text-ink-2">
        {receipt.instalment.label} fees for {receipt.student.firstName} are paid
      </p>
      <dl className="mt-6 w-full divide-y divide-line rounded-xl border border-line text-left text-[13px]">
        <Row k="Receipt no." v={<span className="tnum">{receipt.receipt}</span>} />
        <Row k="Paid on" v={`${fmtDay(receipt.paidOn)}, ${fmtTime(receipt.at ?? new Date())}`} />
        <Row k="Paid by" v={receipt.mode} />
        {receipt.reference && <Row k={receipt.mode === "UPI" ? "UPI ref. no." : "Reference"} v={<span className="tnum">{receipt.reference}</span>} />}
      </dl>
      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        A copy of the receipt has been sent to {g.name.split(" ")[0]} on WhatsApp and by email. It's also saved under Receipts on this page.
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
}
