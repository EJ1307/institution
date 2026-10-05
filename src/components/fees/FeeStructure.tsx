"use client";

import { Bus, HandCoins, Info } from "lucide-react";
import { useMemo } from "react";
import { Badge, Card, CardBody, CardHeader, Meter } from "@/components/ui/primitives";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { academicYear, today } from "@/lib/data/calendar";
import { LATE_FEE, ledger } from "@/lib/data/fees";
import { students } from "@/lib/data/people";
import { GRADES, INSTALMENTS, TRANSPORT_QUARTERLY, annualTuition, instalmentDue } from "@/lib/data/school";
import { ROUTES } from "@/lib/data/transport";
import { fmtDate, fmtDay, number, percent, plural, rupees, rupeesCompact } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { GRACE_DAYS, invoiceDate, lateFeeFrom } from "./lib";

const CONCESSIONS = [
  { label: "Sibling", pct: 10, rule: "Younger child, when an elder sibling is enrolled" },
  { label: "Merit scholarship", pct: 25, rule: "Top 2% in the previous year's finals; reviewed each April" },
  { label: "Staff ward", pct: 50, rule: "Children of permanent staff" },
  { label: "EWS (RTE)", pct: 100, rule: "Seats reserved under the RTE Act; the state reimburses the school" },
];

export function FeeStructure() {
  const payments = useAppState((s) => s.payments);
  const ay = academicYear(today());
  const all = students();

  const bands = useMemo(() => {
    const out: { fee: number; grades: string[]; count: number }[] = [];
    for (const g of GRADES) {
      const fee = annualTuition(g.id);
      const n = all.filter((s) => s.grade === g.id).length;
      const last = out[out.length - 1];
      if (last && last.fee === fee) {
        last.grades.push(g.short === "Nur" ? "Nursery" : g.short);
        last.count += n;
      } else out.push({ fee, grades: [g.short === "Nur" ? "Nursery" : g.short], count: n });
    }
    return out;
  }, [all]);

  const L = useMemo(() => ledger(), [payments]);
  const riders = all.filter((s) => s.routeId).length;

  const conc = useMemo(
    () =>
      CONCESSIONS.map((c) => {
        const list = all.filter((s) => s.concession?.label === c.label);
        const value = list.reduce((a, s) => a + Math.round((annualTuition(s.grade) / 4) * (c.pct / 100)) * 4, 0);
        return { ...c, count: list.length, value };
      }),
    [all],
  );
  const concTotal = conc.reduce((a, c) => a + c.value, 0);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title={`Annual tuition · ${ay.label}`} description="Before concessions. Billed in four equal quarterly instalments." />
        <Table className="min-w-[560px]">
          <THead>
            <tr>
              <Th>Classes</Th>
              <Th align="right">Students</Th>
              <Th align="right">Per quarter</Th>
              <Th align="right">Per year</Th>
            </tr>
          </THead>
          <tbody>
            {bands.map((b) => (
              <Tr key={b.fee}>
                <Td>
                  <p className="font-medium text-ink">{rangeLabel(b.grades)}</p>
                  <p className="text-[12px] text-muted">{b.grades.join(", ")}</p>
                </Td>
                <Td align="right" className="text-ink-2">{number(b.count)}</Td>
                <Td align="right" className="text-ink-2">{rupees(b.fee / 4)}</Td>
                <Td align="right" className="font-semibold text-ink">{rupees(b.fee)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <div className="flex items-start gap-2 border-t border-line px-5 py-3 text-[12.5px] text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          One-time admission fee and refundable caution deposit are collected at admission and are not part of the quarterly bill.
        </div>
      </Card>

      <Card>
        <CardHeader title="Instalment schedule" description={`Invoices go out 25 days ahead · ${rupees(LATE_FEE)} late fee after ${GRACE_DAYS} days`} />
        <ol className="px-5 pb-4">
          {INSTALMENTS.map((ins, i) => {
            const due = instalmentDue(ins.id, ay.startYear);
            const b = L.byInstalment[i];
            const total = b.paid + b.overdue + b.open + b.upcoming;
            const state = b.upcoming > 0 ? "upcoming" : b.open > 0 ? "open" : b.overdue > 0 ? "overdue" : "closed";
            return (
              <li key={ins.id} className="border-t border-line py-3 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium">
                    {ins.label} <span className="font-normal text-muted">· {ins.covers}</span>
                  </p>
                  {state === "upcoming" ? (
                    <Badge tone="neutral">Invoice {fmtDay(invoiceDate(due))}</Badge>
                  ) : state === "open" ? (
                    <Badge tone="warn">Open</Badge>
                  ) : state === "overdue" ? (
                    <Badge tone="bad">{rupeesCompact(b.overdue)} overdue</Badge>
                  ) : (
                    <Badge tone="good">Collected</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] text-muted">
                  Due {fmtDate(due)} · late fee from {fmtDay(lateFeeFrom(due))}
                </p>
                {state !== "upcoming" && (
                  <div className="mt-2 flex items-center gap-3">
                    <Meter value={b.paid / (total || 1)} tone="brand" className="flex-1" label={`${ins.label} collected`} />
                    <span className="tnum w-24 shrink-0 text-right text-[12px] text-muted">{percent(b.paid / (total || 1), 0)} collected</span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader title="Concessions" icon={<HandCoins />} description={`${plural(conc.reduce((a, c) => a + c.count, 0), "student")} · ${rupeesCompact(concTotal)} of tuition waived this year`} />
        <Table className="min-w-[620px]">
          <THead>
            <tr>
              <Th>Concession</Th>
              <Th align="right">Of tuition</Th>
              <Th align="right">Students</Th>
              <Th align="right">Waived this year</Th>
            </tr>
          </THead>
          <tbody>
            {conc.map((c) => (
              <Tr key={c.label}>
                <Td>
                  <p className="font-medium text-ink">{c.label}</p>
                  <p className="text-[12px] text-muted">{c.rule}</p>
                </Td>
                <Td align="right" className="text-ink-2">{c.pct}%</Td>
                <Td align="right" className="text-ink-2">{number(c.count)}</Td>
                <Td align="right" className="font-semibold text-ink">{rupees(c.value)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader title="Transport" icon={<Bus />} description="Same fee on every route, billed with tuition" />
        <CardBody>
          <div className="flex items-baseline gap-2">
            <span className="tnum text-[26px] leading-none font-semibold tracking-[-0.02em]">{rupees(TRANSPORT_QUARTERLY)}</span>
            <span className="text-[12.5px] text-muted">per quarter</span>
          </div>
          <p className="tnum mt-1.5 text-[12.5px] text-muted">{rupees(TRANSPORT_QUARTERLY * 4)} a year · both ways</p>
          <dl className="mt-4 divide-y divide-line border-t border-line text-[13px]">
            <div className="flex justify-between py-2">
              <dt className="text-muted">Routes</dt>
              <dd className="tnum text-ink">{ROUTES.length}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-muted">Students on the bus</dt>
              <dd className="tnum text-ink">{number(riders)}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-muted">Billed this year</dt>
              <dd className="tnum text-ink">{rupeesCompact(riders * TRANSPORT_QUARTERLY * 4)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">Changes take effect from the next quarter. Families opt in or out by writing to transport@amaltas.edu.in before the invoice date.</p>
        </CardBody>
      </Card>
    </div>
  );
}

function rangeLabel(grades: string[]) {
  if (grades.length === 1) return grades[0] === "Nursery" ? "Nursery" : `Class ${grades[0]}`;
  const first = grades[0];
  const last = grades[grades.length - 1];
  if (first === "Nursery") return `Nursery – ${last}`;
  return `Classes ${first} – ${last}`;
}
