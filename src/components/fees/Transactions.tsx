"use client";

import { Receipt as ReceiptIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented, SearchInput, Select } from "@/components/ui/forms";
import { useToast } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/layout";
import { Avatar, Badge, Card, cn } from "@/components/ui/primitives";
import { Pagination, SortTh, Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { addDays, today } from "@/lib/data/calendar";
import { PAYMENT_MODES, type PaymentMode, type Transaction } from "@/lib/data/fees";
import { classLabel } from "@/lib/data/school";
import { fmtDate, fmtTime, number, rupees, rupeesCompact } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { ReceiptSheet } from "./Receipt";
import { receiptFor, type ReceiptData } from "./lib";

type Range = "today" | "7d" | "month" | "year";
type SortKey = "date" | "amount" | "student";
const PAGE = 15;

export function Transactions({ txns, focus, onFocusDone }: { txns: Transaction[]; focus?: ReceiptData | null; onFocusDone?: () => void }) {
  const toast = useToast();
  const payments = useAppState((s) => s.payments);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"all" | PaymentMode>("all");
  const [range, setRange] = useState<Range>("month");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<ReceiptData | null>(null);
  const shown = focus ?? open;

  const t = today();
  const rows = useMemo(() => {
    const from = range === "today" ? t : range === "7d" ? addDays(t, -6) : range === "month" ? new Date(t.getFullYear(), t.getMonth(), 1) : null;
    const needle = q.trim().toLowerCase();
    const at = (x: Transaction) => {
      const p = payments[`${x.student.id}|${x.instalment}`];
      return p?.at ? new Date(p.at).getTime() : 0;
    };
    const list = txns.filter(
      (x) =>
        (!from || x.date >= from) &&
        (mode === "all" || x.mode === mode) &&
        (!needle || x.receipt.toLowerCase().includes(needle) || x.student.name.toLowerCase().includes(needle) || x.student.admissionNo.toLowerCase().includes(needle)),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sort.key === "amount") return (a.amount - b.amount) * dir || b.date.getTime() - a.date.getTime();
      if (sort.key === "student") return a.student.name.localeCompare(b.student.name) * dir;
      return (a.date.getTime() - b.date.getTime()) * dir || (at(a) - at(b)) * dir || a.receipt.localeCompare(b.receipt) * dir;
    });
    return list;
  }, [txns, q, mode, range, sort, payments, t.getTime()]);

  const total = rows.reduce((a, x) => a + x.amount, 0);
  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE);
  const onSort = (k: SortKey) => {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "student" ? "asc" : "desc" }));
    setPage(0);
  };

  return (
    <Card>
      <div className="flex flex-col gap-3 px-5 pt-4 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(0);
            }}
            placeholder="Receipt no., student or admission no."
            className="w-full sm:w-[300px]"
          />
          <Select
            aria-label="Payment mode"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as "all" | PaymentMode);
              setPage(0);
            }}
            className="w-full sm:w-[150px]"
          >
            <option value="all">All modes</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div className="scroll-thin -mx-1 overflow-x-auto px-1">
          <Segmented<Range>
            label="Date range"
            value={range}
            onChange={(v) => {
              setRange(v);
              setPage(0);
            }}
            options={[
              { value: "today", label: "Today" },
              { value: "7d", label: "Last 7 days" },
              { value: "month", label: "This month" },
              { value: "year", label: "This year" },
            ]}
          />
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-line bg-surface-2 px-5 py-2.5 text-[12.5px] text-muted">
        <span>
          <span className="tnum font-semibold text-ink">{number(rows.length)}</span> {rows.length === 1 ? "receipt" : "receipts"}
          {mode !== "all" && ` by ${mode.toLowerCase() === "upi" ? "UPI" : mode.toLowerCase()}`}
        </span>
        <span>
          Total <span className="tnum font-semibold text-ink">{rupees(total)}</span>
          <span className="hidden sm:inline"> · {rupeesCompact(total)}</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon />}
          title={q ? `No receipts match “${q}”` : "No payments in this period"}
          body={range === "today" ? "Payments made online and at the accounts office show up here as they come in." : "Try a wider date range or another payment mode."}
          className="border-t border-line"
        />
      ) : (
        <>
          <Table className="min-w-[760px]">
            <THead>
              <tr>
                <Th>Receipt no.</Th>
                <SortTh label="Student" k="student" sort={sort} onSort={onSort} />
                <Th>Instalment</Th>
                <Th>Mode</Th>
                <SortTh label="Date" k="date" sort={sort} onSort={onSort} />
                <SortTh label="Amount" k="amount" sort={sort} onSort={onSort} align="right" />
              </tr>
            </THead>
            <tbody>
              {pageRows.map((x) => {
                const p = payments[`${x.student.id}|${x.instalment}`];
                const fresh = !!p?.at;
                return (
                  <Tr key={x.receipt + x.student.id} onClick={() => setOpen(receiptFor(x.student, x.instalment))} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(receiptFor(x.student, x.instalment))}>
                    <Td className="tnum text-[12.5px] whitespace-nowrap text-ink-2">
                      {x.receipt}
                      {fresh && (
                        <Badge tone="brand" className="ml-2">
                          {p.source === "parent" ? "Online" : "Counter"}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={x.student.name} size={28} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{x.student.name}</p>
                          <p className="truncate text-[12px] text-muted">
                            {classLabel(x.student.grade, x.student.section)} · {x.student.admissionNo}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-2">{x.instalment}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 text-ink-2">
                        <span className={cn("size-1.5 rounded-full", MODE_DOT[x.mode])} aria-hidden />
                        {x.mode}
                      </span>
                    </Td>
                    <Td className="tnum whitespace-nowrap text-ink-2">{fresh ? `Today, ${fmtTime(new Date(p.at!))}` : fmtDate(x.date)}</Td>
                    <Td align="right" className="font-semibold text-ink">
                      {rupees(x.amount)}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} noun="receipts" />
        </>
      )}

      <ReceiptSheet
        data={shown}
        open={!!shown}
        onClose={() => {
          setOpen(null);
          onFocusDone?.();
        }}
        onResend={() => {
          if (!shown) return;
          const g = shown.student.guardians[0];
          toast({ title: "Receipt sent", body: `${g.name} will get it on WhatsApp and by email in a minute.` });
        }}
      />
    </Card>
  );
}

export const MODE_DOT: Record<PaymentMode, string> = {
  UPI: "bg-s1",
  "Net banking": "bg-s3",
  Card: "bg-s2",
  Cheque: "bg-s4",
  Cash: "bg-[#9A968C]",
};
