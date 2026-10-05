"use client";

import { BellRing, CheckCircle2, IndianRupee, MoreHorizontal, Phone, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Checkbox, Field, SearchInput, Select, Textarea } from "@/components/ui/forms";
import { Dialog, Menu, MenuItem, MenuSeparator, useToast } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/layout";
import { Avatar, Badge, Button, Card, CardHeader, cn } from "@/components/ui/primitives";
import { Pagination, SortTh, Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { addDays, today } from "@/lib/data/calendar";
import type { FeeAccount } from "@/lib/data/fees";
import type { Student } from "@/lib/data/people";
import { GRADES, classLabel, type GradeId } from "@/lib/data/school";
import { fmtDay, number, plural, rupees, rupeesCompact } from "@/lib/format";
import { setState, useAppState } from "@/lib/store";
import { ago, useNow } from "./lib";

type Row = {
  acc: FeeAccount;
  s: Student;
  parent: string;
  phone: string;
  overdue: number;
  quarters: string[];
  oldestDue: Date;
  days: number;
  manual: Date | null;
  auto: Date | null;
};

type SortKey = "amount" | "days" | "family";
const PAGE = 12;
const AUTO_STEPS = [1, 7, 15, 30, 45, 60, 75, 90, 120];

/** The automatic SMS cadence after a due date: day 1, 7, 15, 30, then fortnightly. */
function lastAutoReminder(due: Date, t: Date) {
  let last: Date | null = null;
  for (const d of AUTO_STEPS) {
    const at = addDays(due, d);
    if (at <= t) last = at;
  }
  return last;
}

export function Overdue({
  defaulters,
  grade,
  onGrade,
  onRecord,
}: {
  defaulters: FeeAccount[];
  grade: GradeId | "all";
  onGrade: (g: GradeId | "all") => void;
  onRecord: (s: Student) => void;
}) {
  const toast = useToast();
  const reminders = useAppState((s) => s.reminders);
  const now = useNow(30_000);
  const [q, setQ] = useState("");
  const [hideReminded, setHideReminded] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "amount", dir: "desc" });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composeFor, setComposeFor] = useState<Row[] | null>(null);

  const t = today();
  const all: Row[] = useMemo(
    () =>
      defaulters.map((acc) => {
        const s = acc.student;
        const od = acc.instalments.filter((i) => i.status === "overdue");
        const oldestDue = od[0].due;
        const g = s.guardians[0];
        return {
          acc,
          s,
          parent: `${g.relation === "Mother" ? "Mrs." : "Mr."} ${g.name}`,
          phone: g.phone,
          overdue: acc.overdue,
          quarters: od.map((i) => i.id),
          oldestDue,
          days: Math.round((t.getTime() - oldestDue.getTime()) / 86400000),
          manual: reminders[s.id] ? new Date(reminders[s.id]) : null,
          auto: lastAutoReminder(oldestDue, t),
        };
      }),
    [defaulters, reminders, t.getTime()],
  );

  const rows = useMemo(() => {
    const weekAgo = addDays(now, -7);
    const needle = q.trim().toLowerCase();
    const list = all.filter(
      (r) =>
        (grade === "all" || r.s.grade === grade) &&
        (!hideReminded || !r.manual || r.manual < weekAgo) &&
        (!needle || r.s.name.toLowerCase().includes(needle) || r.parent.toLowerCase().includes(needle) || r.s.admissionNo.toLowerCase().includes(needle)),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) =>
      sort.key === "amount" ? (a.overdue - b.overdue) * dir || b.days - a.days : sort.key === "days" ? (a.days - b.days) * dir || b.overdue - a.overdue : a.parent.localeCompare(b.parent) * dir,
    );
    return list;
  }, [all, q, grade, hideReminded, sort, now]);

  // keep the page in range when filters shrink the list
  useEffect(() => {
    if (page * PAGE >= rows.length && page > 0) setPage(0);
  }, [rows.length, page]);

  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE);
  const pageIds = pageRows.map((r) => r.s.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));
  const selRows = all.filter((r) => selected.has(r.s.id));
  const selTotal = selRows.reduce((a, r) => a + r.overdue, 0);
  const remindedToday = all.filter((r) => r.manual && r.manual.toDateString() === now.toDateString()).length;

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const onSort = (k: SortKey) => {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "family" ? "asc" : "desc" }));
    setPage(0);
  };

  return (
    <Card>
      <CardHeader
        title={`${plural(all.length, "family", "families")} past the due date`}
        description={`${rupees(all.reduce((a, r) => a + r.overdue, 0))} overdue. Automatic SMS reminders go out 1, 7, 15 and 30 days after each due date${remindedToday > 0 ? ` · you've reminded ${plural(remindedToday, "family", "families")} today` : ""}.`}
      />
      <div className="flex flex-col gap-3 px-5 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(0);
            }}
            placeholder="Parent, student or admission no."
            className="w-full sm:w-[280px]"
          />
          <Select
            aria-label="Class"
            value={grade}
            onChange={(e) => {
              onGrade(e.target.value as GradeId | "all");
              setPage(0);
            }}
            className="w-full sm:w-[150px]"
          >
            <option value="all">All classes</option>
            {GRADES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
          <Checkbox checked={hideReminded} onChange={(v) => setHideReminded(v)} label="Hide families reminded this week" className="whitespace-nowrap sm:ml-2" />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="animate-fade-in flex flex-wrap items-center justify-between gap-3 border-t border-line bg-brand-soft/50 px-5 py-2.5">
          <p className="text-[13px] text-ink">
            <span className="font-semibold">{plural(selected.size, "family", "families")}</span> selected
            <span className="text-muted"> · {rupees(selTotal)} overdue</span>
          </p>
          <div className="flex items-center gap-2">
            {selected.size < rows.length && (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(rows.map((r) => r.s.id)))}>
                Select all {rows.length}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" variant="primary" onClick={() => setComposeFor(selRows)}>
              <Send /> Send reminder
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 />}
          title={all.length === 0 ? "No overdue fees" : grade !== "all" ? `Nothing overdue in ${GRADES.find((g) => g.id === grade)?.label}` : "No families match"}
          body={all.length === 0 ? "Every family is paid up to the latest due date." : "Try clearing the search or the class filter."}
          className="border-t border-line"
        />
      ) : (
        <>
          <Table className="min-w-[880px]">
            <THead>
              <tr>
                <Th className="w-10 !pr-0">
                  <span className="sr-only">Select</span>
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allOnPage}
                    ref={(el) => {
                      if (el) el.indeterminate = !allOnPage && someOnPage;
                    }}
                    onChange={(e) => setSelected((prev) => {
                      const next = new Set(prev);
                      pageIds.forEach((id) => (e.target.checked ? next.add(id) : next.delete(id)));
                      return next;
                    })}
                    className="size-4 accent-[var(--brand)]"
                  />
                </Th>
                <SortTh label="Family" k="family" sort={sort} onSort={onSort} />
                <Th>Class</Th>
                <SortTh label="Overdue" k="amount" sort={sort} onSort={onSort} align="right" />
                <SortTh label="Days overdue" k="days" sort={sort} onSort={onSort} align="right" />
                <Th>Last reminder</Th>
                <Th className="w-12">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </THead>
            <tbody>
              {pageRows.map((r) => {
                const on = selected.has(r.s.id);
                return (
                  <Tr key={r.s.id} className={cn(on && "bg-brand-soft/30")}>
                    <Td className="!pr-0">
                      <input type="checkbox" aria-label={`Select ${r.parent}`} checked={on} onChange={(e) => toggle(r.s.id, e.target.checked)} className="size-4 accent-[var(--brand)]" />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.s.name} size={28} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{r.parent}</p>
                          <p className="truncate text-[12px] text-muted">
                            {r.s.name} · {r.s.admissionNo}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-2">{classLabel(r.s.grade, r.s.section)}</Td>
                    <Td align="right">
                      <p className="font-semibold text-ink">{rupees(r.overdue)}</p>
                      <p className="text-[11.5px] font-normal text-muted">{r.quarters.join(" + ")}{r.acc.instalments.some((i) => i.status === "overdue" && i.lateFee) ? " · incl. late fee" : ""}</p>
                    </Td>
                    <Td align="right">
                      <span className={cn("font-medium", r.days > 60 ? "text-bad" : "text-ink-2")}>{r.days}</span>
                      <p className="text-[11.5px] text-muted">since {fmtDay(r.oldestDue)}</p>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {r.manual ? (
                        <Badge tone="info" dot>
                          Reminded {ago(r.manual, now)}
                        </Badge>
                      ) : r.auto ? (
                        <span className="text-[12.5px] text-muted">Auto-SMS · {fmtDay(r.auto)}</span>
                      ) : (
                        <span className="text-[12.5px] text-faint">Not yet</span>
                      )}
                    </Td>
                    <Td>
                      <Menu
                        width={210}
                        label={`Actions for ${r.parent}`}
                        trigger={({ toggle: tg, ref, open }) => (
                          <Button ref={ref} size="icon-sm" variant="ghost" onClick={tg} aria-expanded={open} aria-label={`Actions for ${r.parent}`}>
                            <MoreHorizontal />
                          </Button>
                        )}
                      >
                        {(close) => (
                          <>
                            <MenuItem icon={<BellRing />} onClick={() => { close(); setComposeFor([r]); }}>
                              Send reminder
                            </MenuItem>
                            <MenuItem icon={<IndianRupee />} onClick={() => { close(); onRecord(r.s); }}>
                              Record payment
                            </MenuItem>
                            <MenuSeparator />
                            <a href={`tel:${r.phone.replace(/\s/g, "")}`} role="menuitem" onClick={close} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-ink-2 hover:bg-ink/[0.045] hover:text-ink [&_svg]:size-4">
                              <Phone className="text-muted" /> <span className="flex-1">Call</span> <span className="tnum text-[11.5px] text-faint">{r.phone.slice(4)}</span>
                            </a>
                          </>
                        )}
                      </Menu>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} noun="families" />
        </>
      )}

      <ReminderDialog
        rows={composeFor}
        onClose={() => setComposeFor(null)}
        onSent={(ids, channels) => {
          const at = new Date().toISOString();
          setState((s) => ({ reminders: { ...s.reminders, ...Object.fromEntries(ids.map((id) => [id, at])) } }));
          setSelected(new Set());
          setComposeFor(null);
          toast({
            title: `Reminder sent to ${plural(ids.length, "family", "families")}`,
            body: `By ${channels.join(", ").replace(/, ([^,]*)$/, " and $1")}. Their rows now show when they were last reminded.`,
          });
        }}
      />
    </Card>
  );
}

const CHANNELS = ["SMS", "WhatsApp", "Email"] as const;
type Channel = (typeof CHANNELS)[number];

const TEMPLATE =
  "Dear {parent}, {student}'s fee of {amount} for {quarters} was due on {due}. Please pay in the Kaksha app or at the accounts office (8 am – 2:30 pm) to avoid a further late fee. — Accounts, Amaltas International School";

function fill(tpl: string, r: Row) {
  return tpl
    .replaceAll("{parent}", r.parent)
    .replaceAll("{student}", r.s.firstName)
    .replaceAll("{amount}", rupees(r.overdue))
    .replaceAll("{quarters}", r.quarters.join(" & "))
    .replaceAll("{due}", fmtDay(r.oldestDue));
}

function ReminderDialog({ rows, onClose, onSent }: { rows: Row[] | null; onClose: () => void; onSent: (ids: string[], channels: Channel[]) => void }) {
  const [channels, setChannels] = useState<Set<Channel>>(new Set(["SMS", "WhatsApp"]));
  const [text, setText] = useState(TEMPLATE);
  const [sending, setSending] = useState(false);
  const open = !!rows && rows.length > 0;

  useEffect(() => {
    if (open) {
      setText(TEMPLATE);
      setSending(false);
    }
  }, [open]);

  const first = rows?.[0];
  const preview = first ? fill(text, first) : "";
  const total = rows?.reduce((a, r) => a + r.overdue, 0) ?? 0;
  const smsParts = Math.max(1, Math.ceil(preview.length / 153));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={rows && rows.length === 1 ? `Remind ${rows[0].parent}` : `Remind ${rows ? plural(rows.length, "family", "families") : ""}`}
      description={rows ? `${rupees(total)} overdue${rows.length > 1 ? ` · ${rupeesCompact(total)} across the selection` : ` for ${rows[0].s.name}`}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={channels.size === 0 || !text.trim()}
            loading={sending}
            onClick={() => {
              setSending(true);
              setTimeout(() => onSent(rows!.map((r) => r.s.id), CHANNELS.filter((c) => channels.has(c))), 650);
            }}
          >
            <Send /> Send{rows && rows.length > 1 ? ` to ${number(rows.length)}` : ""}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <fieldset>
          <legend className="mb-2 text-[12.5px] font-medium text-ink-2">Send by</legend>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => {
              const on = channels.has(c);
              return (
                <label
                  key={c}
                  className={cn(
                    "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors",
                    on ? "border-brand bg-brand-soft/50 text-ink" : "border-line-strong/80 text-ink-2 hover:border-line-strong",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[var(--brand)]"
                    checked={on}
                    onChange={(e) =>
                      setChannels((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(c);
                        else next.delete(c);
                        return next;
                      })
                    }
                  />
                  {c}
                </label>
              );
            })}
          </div>
          {channels.size === 0 && <p className="mt-2 text-[12px] text-bad">Pick at least one channel.</p>}
        </fieldset>

        <Field
          label="Message"
          htmlFor="rem-text"
          hint={
            <>
              Placeholders: <code className="text-ink-2">{"{parent}"}</code> <code className="text-ink-2">{"{student}"}</code> <code className="text-ink-2">{"{amount}"}</code> <code className="text-ink-2">{"{quarters}"}</code> <code className="text-ink-2">{"{due}"}</code>
            </>
          }
        >
          <Textarea id="rem-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} />
        </Field>

        {first && (
          <div>
            <div className="mb-2 flex items-center justify-between text-[12px] text-muted">
              <span>Preview for {first.parent}</span>
              {channels.has("SMS") && <span className="tnum">{preview.length} characters · {plural(smsParts, "SMS")} each</span>}
            </div>
            <div className="rounded-xl bg-paper p-3">
              <p className="max-w-[92%] rounded-2xl rounded-tl-md bg-surface px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-2 shadow-[var(--shadow-card)]">{preview}</p>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
