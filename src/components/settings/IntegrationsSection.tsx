"use client";

import { BookCheck, Calculator, CreditCard, Fingerprint, KeyRound, MessageSquareText, type LucideIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useToast } from "@/components/ui/overlay";
import { Badge, Button, Card, cn } from "@/components/ui/primitives";
import { downloadCsv } from "@/components/students/shared";
import { documentsFor } from "@/components/students/profileData";
import { addDays, isoDate, today } from "@/lib/data/calendar";
import { ledger } from "@/lib/data/fees";
import { students } from "@/lib/data/people";
import { classLabel, examSubjects } from "@/lib/data/school";
import { fmtDay, number, percent, rupeesCompact } from "@/lib/format";
import { setState, useAppState } from "@/lib/store";

type Integration = {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  defaultOn: boolean;
  meta: (on: boolean) => { k: string; v: ReactNode }[];
  primary?: { label: string; run: () => void };
};

export function IntegrationsSection() {
  const toast = useToast();
  const saved = useAppState((s) => s.settings.integrations);
  const payments = useAppState((s) => s.payments);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const L = useMemo(() => ledger(), [payments]);
  const online = L.modes.UPI + L.modes["Net banking"] + L.modes.Card;

  const board = useMemo(() => {
    const t = today();
    const list = students().filter((s) => s.grade === "9" || s.grade === "11");
    // only the documents the board asks for: birth certificate, Aadhaar, photographs, transfer certificate
    const needed = new Set(["birth", "aadhaar", "photos", "tc"]);
    const missing = list.filter((s) => documentsFor(s, t).some((d) => needed.has(d.id) && (d.status === "missing" || d.status === "pending")));
    return { list, missing };
  }, []);

  const exportVouchers = () => {
    const from = addDays(today(), -30);
    const rows = L.txns.filter((x) => x.date >= from);
    downloadCsv(
      `fee-vouchers-${isoDate(from)}-to-${isoDate(today())}.csv`,
      ["Voucher date", "Receipt no.", "Ledger", "Student", "Class", "Admission no.", "Instalment", "Mode", "Amount (INR)"],
      rows.map((x) => [isoDate(x.date), x.receipt, x.mode === "Cash" ? "Cash in hand" : "Bank — current account", x.student.name, classLabel(x.student.grade, x.student.section), x.student.admissionNo, x.instalment, x.mode, x.amount]),
    );
    toast({ title: `${number(rows.length)} vouchers exported`, body: "Fee receipts from the last 30 days, ready to import into your accounting software." });
  };

  const exportBoard = () => {
    downloadCsv(
      `cbse-registration-ix-xi-${isoDate(today())}.csv`,
      ["Class", "Section", "Roll", "Candidate name", "Gender", "Date of birth", "Father's name", "Mother's name", "Subjects", "Admission no.", "Documents complete"],
      board.list.map((s) => {
        const father = s.guardians.find((g) => g.relation === "Father")?.name ?? "";
        const mother = s.guardians.find((g) => g.relation === "Mother")?.name ?? "";
        return [s.grade === "9" ? "IX" : "XI", s.section, s.roll, s.name.toUpperCase(), s.gender === "F" ? "F" : "M", s.dob, father.toUpperCase(), mother.toUpperCase(), examSubjects(s.grade, s.section).map((x) => x.name).join("; "), s.admissionNo, board.missing.includes(s) ? "No" : "Yes"];
      }),
    );
    toast({ title: "Registration file generated", body: `${number(board.list.length)} candidates for Classes IX and XI. ${board.missing.length} still have documents to verify — they're flagged in the file.` });
  };

  const items: Integration[] = [
    {
      id: "payments",
      icon: CreditCard,
      title: "Online fee payments",
      body: "UPI, cards and net banking through an RBI-authorised payment aggregator. Money settles directly into the school's own bank account.",
      defaultOn: true,
      meta: (on) =>
        on
          ? [
              { k: "Collected online this year", v: `${rupeesCompact(online)} · ${percent(online / (L.collected || 1), 0)} of fees` },
              { k: "Settlement", v: "T+1 to current a/c ••4471" },
            ]
          : [{ k: "Status", v: "Parents can only pay at the accounts counter" }],
    },
    {
      id: "messaging",
      icon: MessageSquareText,
      title: "SMS & WhatsApp",
      body: "A DLT-registered SMS sender ID and a verified WhatsApp business number for absence alerts, fee reminders and notices.",
      defaultOn: true,
      meta: (on) =>
        on
          ? [
              { k: "Templates", v: "31 SMS · 24 WhatsApp" },
              { k: "Delivered last 30 days", v: "98.6% within 60 seconds" },
            ]
          : [{ k: "Status", v: "Families receive app notifications only" }],
    },
    {
      id: "biometric",
      icon: Fingerprint,
      title: "Biometric attendance devices",
      body: "Face and fingerprint terminals at the staff entrance and both school gates. Check-ins sync to staff attendance every five minutes.",
      defaultOn: true,
      meta: (on) =>
        on
          ? [
              { k: "Devices", v: "6 of 6 online" },
              { k: "Last sync", v: "Today, 8:02 am" },
            ]
          : [{ k: "Status", v: "Staff attendance is marked manually" }],
    },
    {
      id: "accounting",
      icon: Calculator,
      title: "Accounting export",
      body: "Daily fee collections and receipts as vouchers (XML or CSV), mapped to your ledgers, for the accounts team's software.",
      defaultOn: true,
      meta: (on) =>
        on
          ? [
              { k: "Schedule", v: "Every night at 11 pm" },
              { k: "Last export", v: `${fmtDay(addDays(today(), -1))} · ${number(L.txns.filter((x) => isoDate(x.date) === isoDate(addDays(today(), -1))).length)} vouchers` },
            ]
          : [{ k: "Status", v: "Export manually when needed" }],
      primary: { label: "Export last 30 days", run: exportVouchers },
    },
    {
      id: "sso",
      icon: KeyRound,
      title: "Single sign-on for staff",
      body: "Staff sign in with the school email accounts they already use, over SAML 2.0 or OpenID Connect. Leavers lose access the moment their account is closed.",
      defaultOn: false,
      meta: (on) =>
        on
          ? [
              { k: "Domain", v: "amaltas.edu.in" },
              { k: "Staff signed in via SSO", v: "104 of 109" },
            ]
          : [{ k: "Today", v: "Portal passwords + two-step verification" }],
    },
    {
      id: "cbse",
      icon: BookCheck,
      title: "CBSE registration export",
      body: "Class IX and XI registration, and the List of Candidates for X and XII, in the board's upload format — checked for missing documents first.",
      defaultOn: true,
      meta: () => [
        { k: "Candidates (IX & XI)", v: number(board.list.length) },
        { k: "Ready to submit", v: <span className={cn(board.missing.length && "text-warn")}>{`${number(board.list.length - board.missing.length)} · ${board.missing.length} need documents`}</span> },
      ],
      primary: { label: "Generate file", run: exportBoard },
    },
  ];

  const isOn = (i: Integration) => saved?.[i.id] ?? i.defaultOn;
  const setOn = (i: Integration, v: boolean) => {
    setState((st) => ({ settings: { ...st.settings, integrations: { ...st.settings.integrations, [i.id]: v } } }));
    toast(
      v
        ? { title: `${i.title} connected`, body: i.id === "sso" ? "Setup steps have gone to it@amaltas.edu.in. Staff can keep using passwords until you switch over." : "It's live for the whole school." }
        : { title: `${i.title} paused`, body: "Nothing is deleted — reconnect any time.", tone: "info" },
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {items.map((i) => {
        const on = isOn(i);
        return (
          <Card key={i.id} className="flex flex-col">
            <div className="flex items-start gap-3.5 px-5 pt-5">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-5", on ? "bg-brand-soft text-brand" : "bg-ink/[0.045] text-muted")}>
                <i.icon strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-ink">{i.title}</h3>
                  {i.id === "cbse" ? <Badge tone="outline">Built in</Badge> : on ? <Badge tone="good" dot>Connected</Badge> : <Badge tone="neutral">Not connected</Badge>}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{i.body}</p>
              </div>
            </div>
            <dl className="mx-5 mt-4 mb-4 grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg bg-surface-2 px-3.5 py-3 text-[12.5px] sm:grid-cols-2">
              {i.meta(on).map((m) => (
                <div key={m.k} className="min-w-0">
                  <dt className="text-[11.5px] text-muted">{m.k}</dt>
                  <dd className="tnum font-medium text-ink">{m.v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-auto flex items-center justify-end gap-2 border-t border-line px-5 py-3">
              {i.id !== "cbse" &&
                (on ? (
                  <Button size="sm" variant="ghost" onClick={() => setOn(i, false)}>
                    Disconnect
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" onClick={() => setOn(i, true)}>
                    Connect
                  </Button>
                ))}
              {i.primary && (
                <Button size="sm" variant="secondary" onClick={i.primary.run} disabled={i.id !== "cbse" && !on}>
                  {i.primary.label}
                </Button>
              )}
              {!i.primary && on && (
                <Button size="sm" variant="secondary" onClick={() => toast({ title: `${i.title} settings`, body: "Your account manager has the configuration; changes go live within a working day.", tone: "info" })}>
                  Configure
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
