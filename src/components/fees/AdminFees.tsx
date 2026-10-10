"use client";

import { ArrowRight, Download, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { Legend, SERIES, StackedBar } from "@/components/charts/misc";
import { Tabs } from "@/components/ui/forms";
import { useToast } from "@/components/ui/overlay";
import { PageHeader, Stat } from "@/components/ui/layout";
import { Avatar, Button, Card, CardBody, CardHeader, cn, Meter } from "@/components/ui/primitives";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { academicYear, today } from "@/lib/data/calendar";
import { ledger, PAYMENT_MODES } from "@/lib/data/fees";
import type { Student } from "@/lib/data/people";
import { GRADES, classLabel, type GradeId } from "@/lib/data/school";
import { fmtDay, fmtMonth, number, percent, plural, dollars, dollarsCompact } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { FeeStructure } from "./FeeStructure";
import { Overdue } from "./Overdue";
import { RecordPaymentDialog } from "./RecordPayment";
import { ReceiptSheet } from "./Receipt";
import { Transactions } from "./Transactions";
import { receiptFor, type ReceiptData } from "./lib";

const TABS = ["overview", "transactions", "overdue", "structure"] as const;
type Tab = (typeof TABS)[number];
const MODE_COLORS = [SERIES.s1, SERIES.s3, SERIES.s2, SERIES.s4, "#9A968C"];

export function AdminFees() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const payments = useAppState((s) => s.payments);
  const L = useMemo(() => ledger(), [payments]);

  const raw = params.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "overview";
  const gradeParam = params.get("grade");
  const grade: GradeId | "all" = GRADES.some((g) => g.id === gradeParam) ? (gradeParam as GradeId) : "all";

  const go = (next: Partial<{ tab: Tab; grade: GradeId | "all" }>) => {
    const sp = new URLSearchParams(params.toString());
    const t = next.tab ?? tab;
    if (t === "overview") sp.delete("tab");
    else sp.set("tab", t);
    const g = next.grade ?? (next.tab && next.tab !== tab ? "all" : grade);
    if (g === "all") sp.delete("grade");
    else sp.set("grade", g);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const [recording, setRecording] = useState<{ student: Student | null } | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const t = today();
  const ay = academicYear(t);
  const open = L.byInstalment.find((b) => b.open > 0) ?? null;
  const daysToDue = open ? Math.round((open.due.getTime() - t.getTime()) / 86400000) : 0;
  const rate = L.collected / (L.billed || 1);
  const monthIdx = (t.getFullYear() - ay.startYear) * 12 + t.getMonth() - 3;
  const thisMonth = L.months[monthIdx];
  const monthReceipts = L.txns.filter((x) => x.date.getMonth() === t.getMonth() && x.date.getFullYear() === t.getFullYear()).length;
  const online = L.modes.UPI + L.modes["Net banking"] + L.modes.Card;

  return (
    <>
      <PageHeader
        eyebrow={`Accounts · AY ${ay.label}`}
        title="Fees"
        description={
          open
            ? `${open.label} (${open.covers}) falls due on ${fmtDay(open.due)}${daysToDue > 0 ? ` — ${plural(daysToDue, "day")} to go` : ""}. Tuition and transport are billed together each quarter.`
            : "Tuition and transport are billed together in four quarterly instalments."
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => toast({ title: "Fee register is being prepared", body: `An Excel file with all ${number(L.txns.length)} receipts for ${ay.label} will download shortly.`, tone: "info" })}
            >
              <Download /> Export
            </Button>
            <Button variant="primary" onClick={() => setRecording({ student: null })}>
              <Plus /> Record payment
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          className="col-span-2 lg:col-span-1"
          label={`Collected · ${ay.label}`}
          value={dollarsCompact(L.collected)}
          sub={<span className="tnum">{dollarsCompact(thisMonth?.collected ?? 0)} in {fmtMonth(t)} · {number(monthReceipts)} receipts</span>}
        />
        <Stat label="Billed so far" value={dollarsCompact(L.billed)} sub={<span className="tnum">of {dollarsCompact(L.annualTotal)} for the year</span>} />
        <Stat
          label="Collection rate"
          value={percent(rate)}
          sub={<span className="tnum">{dollarsCompact(L.billed - L.collected)} billed, not yet in</span>}
        />
        <Stat
          href="/fees?tab=overdue"
          label="Overdue"
          value={<span className="text-bad">{dollarsCompact(L.overdue)}</span>}
          sub={`${plural(L.defaulters.length, "family", "families")} past due`}
        />
        <Stat
          label="Due now"
          value={dollarsCompact(L.dueNow)}
          sub={open ? `${open.id} · due ${fmtDay(open.due)}` : "Nothing open right now"}
        />
      </div>

      <Tabs<Tab>
        className="mt-6 mb-4"
        value={tab}
        onChange={(v) => go({ tab: v })}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "transactions", label: "Transactions" },
          { value: "overdue", label: "Overdue", count: L.defaulters.length },
          { value: "structure", label: "Fee structure" },
        ]}
      />

      {tab === "overview" && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Collections by month"
                description="Fees received, all modes · peaks follow the 10 Apr, 10 Jul, 10 Oct and 10 Jan due dates"
                action={
                  <Button variant="ghost" size="sm" onClick={() => go({ tab: "transactions" })}>
                    Transactions <ArrowRight />
                  </Button>
                }
              />
              <CardBody>
                <ColumnChart
                  ariaLabel="Fees collected each month of the academic year"
                  categories={L.months.map((m) => fmtMonth(m.month))}
                  series={[{ id: "collected", label: "Collected", color: SERIES.s1, values: L.months.map((m) => m.collected) }]}
                  highlight={monthIdx >= 0 && monthIdx < 12 ? monthIdx : undefined}
                  yFormat={(n) => dollarsCompact(n, 0)}
                  valueFormat={(n) => dollarsCompact(n)}
                  height={240}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="By instalment" description="Where each quarter's bill stands" />
              <CardBody>
                <Legend
                  className="mb-4"
                  items={[
                    { label: "Collected", color: SERIES.s1 },
                    { label: "Overdue", color: SERIES.s4 },
                    { label: "Due", color: SERIES.s2 },
                    { label: "Not billed", color: SERIES.muted },
                  ]}
                />
                <ColumnChart
                  ariaLabel="Collected, overdue, due and not yet billed for each quarterly instalment"
                  categories={L.byInstalment.map((b) => b.id)}
                  series={[
                    { id: "paid", label: "Collected", color: SERIES.s1, values: L.byInstalment.map((b) => b.paid) },
                    { id: "overdue", label: "Overdue", color: SERIES.s4, values: L.byInstalment.map((b) => b.overdue) },
                    { id: "open", label: "Due", color: SERIES.s2, values: L.byInstalment.map((b) => b.open) },
                    { id: "upcoming", label: "Not billed", color: SERIES.muted, values: L.byInstalment.map((b) => b.upcoming) },
                  ]}
                  stacked
                  maxBar={40}
                  yFormat={(n) => dollarsCompact(n, 0)}
                  valueFormat={(n) => dollarsCompact(n)}
                  height={206}
                />
              </CardBody>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ByClass onPick={(g) => go({ tab: "overdue", grade: g })} />

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader title="How families pay" description={`Share of ${dollarsCompact(L.collected)} collected this year`} />
                <CardBody>
                  <div className="mb-4 flex items-baseline gap-2">
                    <span className="text-[26px] leading-none font-semibold tracking-[-0.02em]">{percent(online / (L.collected || 1), 0)}</span>
                    <span className="text-[12.5px] text-muted">paid online — UPI, net banking and cards</span>
                  </div>
                  <StackedBar segments={PAYMENT_MODES.map((m, i) => ({ label: m, value: L.modes[m], color: MODE_COLORS[i] }))} format={(n) => dollarsCompact(n)} columns={1} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader
                  title="Largest overdue accounts"
                  action={
                    <Button variant="ghost" size="sm" onClick={() => go({ tab: "overdue" })}>
                      All {L.defaulters.length}
                    </Button>
                  }
                />
                <ul className="px-5 pb-3">
                  {L.defaulters.slice(0, 5).map((a) => (
                    <li key={a.student.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                      <Avatar name={a.student.name} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{a.student.name}</p>
                        <p className="truncate text-[12px] text-muted">
                          {classLabel(a.student.grade, a.student.section)} · {a.instalments.filter((i) => i.status === "overdue").map((i) => i.id).join(" + ")}
                        </p>
                      </div>
                      <span className="tnum text-[13px] font-semibold text-bad">{dollars(a.overdue)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </div>
      )}

      {tab === "transactions" && (
        <div className="animate-fade-in">
          <Transactions txns={L.txns} focus={receipt} onFocusDone={() => setReceipt(null)} />
        </div>
      )}

      {tab === "overdue" && (
        <div className="animate-fade-in">
          <Overdue defaulters={L.defaulters} grade={grade} onGrade={(g) => go({ grade: g })} onRecord={(s) => setRecording({ student: s })} />
        </div>
      )}

      {tab === "structure" && (
        <div className="animate-fade-in">
          <FeeStructure />
        </div>
      )}

      <RecordPaymentDialog
        open={!!recording}
        initialStudent={recording?.student ?? null}
        onClose={() => setRecording(null)}
        onRecorded={(s, id) => setReceipt(receiptFor(s, id))}
      />
      {tab !== "transactions" && <ReceiptSheet data={receipt} open={!!receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

function ByClass({ onPick }: { onPick: (g: GradeId) => void }) {
  const payments = useAppState((s) => s.payments);
  const rows = useMemo(() => {
    const L = ledger();
    return GRADES.map((g) => {
      const accs = L.accounts.filter((a) => a.student.grade === g.id);
      let billed = 0;
      let collected = 0;
      let overdue = 0;
      for (const a of accs)
        for (const i of a.instalments) {
          if (i.status !== "upcoming") billed += i.amount;
          if (i.status === "paid") collected += i.amount;
          if (i.status === "overdue") overdue += i.amount;
        }
      const families = accs.filter((a) => a.overdue > 0).length;
      return { g, students: accs.length, billed, collected, overdue, families, rate: collected / (billed || 1) };
    });
  }, [payments]);

  return (
    <Card className="xl:col-span-2">
      <CardHeader title="Collection by class" description="Billed to date against collected · select a class to see its overdue families" />
      <Table className="min-w-[640px]">
        <THead>
          <tr>
            <Th>Class</Th>
            <Th align="right">Students</Th>
            <Th align="right">Billed</Th>
            <Th align="right">Collected</Th>
            <Th align="right">Overdue</Th>
            <Th align="right">Families</Th>
            <Th className="w-[170px]">Collection rate</Th>
          </tr>
        </THead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.g.id} onClick={() => onPick(r.g.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onPick(r.g.id)} className="[&>td]:h-10">
              <Td className="font-medium text-ink">{r.g.label}</Td>
              <Td align="right" className="text-ink-2">{number(r.students)}</Td>
              <Td align="right" className="text-ink-2">{dollarsCompact(r.billed)}</Td>
              <Td align="right" className="text-ink">{dollarsCompact(r.collected)}</Td>
              <Td align="right" className={cn(r.overdue > 0 ? "text-bad" : "text-faint")}>
                {r.overdue > 0 ? dollarsCompact(r.overdue) : "—"}
              </Td>
              <Td align="right" className={cn(r.families > 0 ? "text-ink-2" : "text-faint")}>
                {r.families || "—"}
              </Td>
              <Td>
                <div className="flex items-center gap-2.5">
                  <Meter value={r.rate} tone={r.rate < 0.8 ? "warn" : "brand"} className="flex-1" label={`${r.g.label} collection rate`} />
                  <span className="tnum w-11 text-right text-[12px] font-medium text-ink-2">{percent(r.rate, 0)}</span>
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
