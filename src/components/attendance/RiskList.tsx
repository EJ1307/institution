"use client";

import { BellRing, Check, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Select, SearchInput, Switch, Tabs } from "@/components/ui/forms";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, Card, cn, Meter } from "@/components/ui/primitives";
import { Pagination, SortTh, Td, Th, THead, Tr, Table } from "@/components/ui/table";
import { currentSchoolDay, markFor } from "@/lib/data/attendance";
import { academicYear, isoDate } from "@/lib/data/calendar";
import { students, type Student } from "@/lib/data/people";
import { classLabel, GRADES } from "@/lib/data/school";
import { fmtDay, fmtWeekday, percent, plural } from "@/lib/format";
import { setState, useAppState } from "@/lib/store";
import { termDays, termSummaryCached, yearDays } from "./shared";

type Tab = "below" | "watch";
type SortKey = "rate" | "name" | "class" | "needed";

const PAGE = 15;

export function RiskList() {
  const toast = useToast();
  const attendanceStore = useAppState((s) => s.attendance);
  const alerts = useAppState((s) => s.attendanceAlerts);
  const [tab, setTab] = useState<Tab>("below");
  const [grade, setGrade] = useState("all");
  const [boardOnly, setBoardOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "rate", dir: "asc" });
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState(false);

  const today = currentSchoolDay();
  const ay = academicYear(today);
  const elapsed = termDays(today).length;
  const total = yearDays(today).length;
  const remaining = total - elapsed;

  const all = useMemo(() => {
    return students()
      .map((s) => {
        const sum = termSummaryCached(s, today);
        const attended = sum.present + sum.late;
        // present days still needed to finish the year at 75%
        const needed = Math.max(0, Math.ceil(0.75 * total) - attended);
        let lastAway: Date | null = null;
        if (sum.rate < 0.85) {
          for (const d of [...termDays(today)].reverse().slice(0, 40)) {
            const m = markFor(s, d);
            if (m === "A" || m === "E") {
              lastAway = d;
              break;
            }
          }
        }
        return { s, sum, needed, reachable: needed <= remaining, lastAway };
      })
      .filter((x) => x.sum.rate < 0.85);
  }, [isoDate(today), attendanceStore]);

  const below = all.filter((x) => x.sum.rate < 0.75);
  const watch = all.filter((x) => x.sum.rate >= 0.75);
  const pool = tab === "below" ? below : watch;

  const isBoard = (s: Student) => s.grade === "10" || s.grade === "12";
  const filtered = pool
    .filter((x) => (grade === "all" ? true : x.s.grade === grade))
    .filter((x) => (boardOnly ? isBoard(x.s) : true))
    .filter((x) => (q ? `${x.s.name} ${x.s.admissionNo}`.toLowerCase().includes(q.toLowerCase()) : true))
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "name") return a.s.name.localeCompare(b.s.name) * dir;
      if (sort.key === "class") return (GRADES.findIndex((g) => g.id === a.s.grade) - GRADES.findIndex((g) => g.id === b.s.grade) || a.s.section.localeCompare(b.s.section)) * dir;
      if (sort.key === "needed") return (a.needed / Math.max(1, remaining) - b.needed / Math.max(1, remaining)) * dir;
      return (a.sum.rate - b.sum.rate) * dir;
    });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageSafe = Math.min(page, pages - 1);
  const rows = filtered.slice(pageSafe * PAGE, pageSafe * PAGE + PAGE);
  const pendingNotify = filtered.filter((x) => !alerts[x.s.id]);

  const onSort = (k: SortKey) => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === "asc" ? "desc" : "asc") : "asc" }));

  const notify = (list: Student[]) => {
    const at = new Date().toISOString();
    setState((st) => ({ attendanceAlerts: { ...st.attendanceAlerts, ...Object.fromEntries(list.map((s) => [s.id, at])) } }));
  };

  const notifyOne = (s: Student) => {
    notify([s]);
    const g = s.guardians[0];
    toast({ title: `${g.name} has been notified`, body: `SMS and app alert: ${s.firstName}'s attendance is ${percent(termSummaryCached(s, today).rate)} this term. A meeting slot with the class teacher is attached.` });
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Attendance", href: "/attendance" }, { label: "Below 75%" }]}
        title="Attendance eligibility"
        description={`CBSE requires 75% attendance to sit the board examinations. Term to date: ${elapsed} school days since 1 April, ${remaining} left in AY ${ay.label}.`}
        actions={
          <Button variant="primary" disabled={pendingNotify.length === 0} onClick={() => setConfirm(true)}>
            <BellRing /> Notify parents{pendingNotify.length ? ` (${pendingNotify.length})` : ""}
          </Button>
        }
      />

      <Tabs
        value={tab}
        onChange={(v) => (setTab(v), setPage(0))}
        tabs={[
          { value: "below", label: "Below 75%", count: below.length },
          { value: "watch", label: "Watch list · 75–85%", count: watch.length },
        ]}
      />

      <p className="mt-3 max-w-3xl text-[12.5px] text-muted">
        {tab === "below"
          ? "These students will need a condonation request unless attendance improves. Anyone marked “cannot reach 75%” needs a medical certificate on file before the board registration."
          : "Close to the line — a short illness or a family trip would take them under 75%."}
      </p>

      <Card className="mt-3">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <Select value={grade} onChange={(e) => (setGrade(e.target.value), setPage(0))} aria-label="Filter by class">
            <option value="all">All classes</option>
            {GRADES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
          <label className="flex h-9 items-center gap-2 rounded-lg px-1.5 text-[12.5px] text-ink-2">
            <Switch checked={boardOnly} onChange={(v) => (setBoardOnly(v), setPage(0))} label="Board classes only" />
            Classes X & XII only
          </label>
          <SearchInput value={q} onChange={(v) => (setQ(v), setPage(0))} placeholder="Search students" className="w-full sm:ml-auto sm:w-[220px]" />
        </div>
        <Table>
          <THead>
            <tr>
              <SortTh label="Student" k="name" sort={sort} onSort={onSort} />
              <SortTh label="Class" k="class" sort={sort} onSort={onSort} />
              <SortTh label="This term" k="rate" sort={sort} onSort={onSort} className="w-[180px]" />
              <Th align="right">Absent</Th>
              <Th align="right">Leave</Th>
              <SortTh label="To finish at 75%" k="needed" sort={sort} onSort={onSort} />
              <Th className="hidden lg:table-cell">Last away</Th>
              <Th align="right">Parents</Th>
            </tr>
          </THead>
          <tbody>
            {rows.map(({ s, sum, needed, reachable, lastAway }) => {
              const alerted = alerts[s.id];
              return (
                <Tr key={s.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={s.name} size={28} />
                      <div className="min-w-0">
                        <Link href={`/students/${s.id}`} className="block truncate font-medium whitespace-nowrap hover:underline">
                          {s.name}
                        </Link>
                        <p className="truncate text-[12px] text-muted">{s.guardians[0].name}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {classLabel(s.grade, s.section)}
                      {isBoard(s) && <Badge tone="outline">Board</Badge>}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Meter value={sum.rate} tone={sum.rate < 0.75 ? "bad" : "warn"} className="w-16" label={`${s.firstName}'s attendance`} />
                      <span className={cn("tnum font-semibold", sum.rate < 0.75 ? "text-bad" : "text-warn")}>{percent(sum.rate)}</span>
                    </div>
                  </Td>
                  <Td align="right">{sum.absent}</Td>
                  <Td align="right" className="text-muted">
                    {sum.leave}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {reachable ? (
                      <span className="text-ink-2">
                        <span className="tnum font-medium text-ink">{needed}</span> of {remaining} days
                      </span>
                    ) : (
                      <span className="font-medium text-bad">Cannot reach 75%</span>
                    )}
                  </Td>
                  <Td className="hidden whitespace-nowrap text-ink-2 lg:table-cell">{lastAway ? fmtWeekday(lastAway) : "—"}</Td>
                  <Td align="right">
                    {alerted ? (
                      <Badge tone="good">
                        <Check className="size-3" /> Notified {fmtDay(new Date(alerted))}
                      </Badge>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => notifyOne(s)}>
                        Notify
                      </Button>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert />}
            title={q ? `No student matches “${q}”` : "No one in this group"}
            body={grade !== "all" || boardOnly ? "Nobody in the selected classes is in this band. Clear the filters to see the whole school." : "Every student is comfortably above the line."}
            action={
              grade !== "all" || boardOnly || q ? (
                <Button variant="secondary" onClick={() => (setGrade("all"), setBoardOnly(false), setQ(""))}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Pagination page={pageSafe} pageSize={PAGE} total={filtered.length} onPage={setPage} noun="students" />
        )}
      </Card>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Notify ${plural(pendingNotify.length, "family", "families")}?`}
        description="Parents get an SMS and an app alert with their child's attendance and a link to book a meeting with the class teacher."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                notify(pendingNotify.map((x) => x.s));
                setConfirm(false);
                toast({ title: `${plural(pendingNotify.length, "family", "families")} notified`, body: "Class teachers are copied and replies will appear in their inbox." });
              }}
            >
              <BellRing /> Send now
            </Button>
          </>
        }
      >
        <div className="rounded-xl border border-line bg-surface-2 p-4 text-[13px] leading-relaxed text-ink-2">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Message preview</p>
          Dear Parent, {pendingNotify[0]?.s.firstName ?? "your child"}&rsquo;s attendance this term is{" "}
          {pendingNotify[0] ? percent(pendingNotify[0].sum.rate) : "below 85%"}. CBSE requires 75% to appear in board examinations. Please meet the class teacher
          this week — book a slot in the app. — Amaltas International School
        </div>
        <p className="mt-3 text-[12.5px] text-muted">
          {pendingNotify.length} of {filtered.length} families in this view haven&rsquo;t been contacted yet
          {filtered.length > pendingNotify.length ? `; ${filtered.length - pendingNotify.length} notified earlier will be skipped.` : "."}
        </p>
      </Dialog>
    </>
  );
}
