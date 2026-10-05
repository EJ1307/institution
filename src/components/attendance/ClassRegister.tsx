"use client";

import { BellRing, ClipboardList, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Segmented, SearchInput, Tabs } from "@/components/ui/forms";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { useToast } from "@/components/ui/overlay";
import { Avatar, Button, Card, cn, Meter } from "@/components/ui/primitives";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { classDay, currentSchoolDay, isMarked, markFor, type Mark } from "@/lib/data/attendance";
import { academicYear, isoDate, schoolDaysBack } from "@/lib/data/calendar";
import { classTeacher, studentsInClass } from "@/lib/data/people";
import { classLabel, classLabelLong, CLASSES } from "@/lib/data/school";
import { fmtWeekday, fmtWeekdayLong, number, percent } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { MARK_META, MarkBadge, MarkStrip, rateTone, SchoolDayPicker, termSummaryCached } from "./shared";

type Filter = "all" | "away" | "L";

/** Principal's read-only view of one class register (?class=8-B). */
export function ClassRegister({ classKey, day }: { classKey: string; day: Date }) {
  const router = useRouter();
  const toast = useToast();
  const attendanceStore = useAppState((s) => s.attendance);
  const meta = useAppState((s) => s.registerMeta);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const ref = CLASSES.find((c) => c.key === classKey)!;
  const label = classLabel(ref.grade, ref.section);
  const today = currentSchoolDay();
  const iso = isoDate(day);
  const isToday = iso === isoDate(today);
  const ay = academicYear(today);
  const teacher = classTeacher(classKey);
  const marked = isMarked(classKey, day);
  const regMeta = meta[`${classKey}|${iso}`];

  const go = (d: Date) => router.replace(`/attendance?class=${classKey}${isoDate(d) === isoDate(today) ? "" : `&date=${isoDate(d)}`}`, { scroll: false });

  const tabs = useMemo(() => schoolDaysBack(6, today).reverse(), [isoDate(today)]);

  const data = useMemo(() => {
    const roster = studentsInClass(classKey);
    const strip = schoolDaysBack(10, day);
    const rows = roster.map((s) => ({ s, mark: markFor(s, day), term: termSummaryCached(s, day) }));
    return { rows, strip, count: classDay(classKey, day) };
  }, [classKey, iso, attendanceStore]);

  const counts = {
    all: data.rows.length,
    away: data.rows.filter((r) => r.mark === "A" || r.mark === "E").length,
    L: data.rows.filter((r) => r.mark === "L").length,
  };
  const termRate = data.rows.reduce((a, r) => a + r.term.rate, 0) / (data.rows.length || 1);

  const shown = data.rows.filter((r) => {
    if (filter === "away" && !(r.mark === "A" || r.mark === "E")) return false;
    if (filter === "L" && r.mark !== "L") return false;
    if (q && !`${r.s.name} ${r.s.roll} ${r.s.admissionNo}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Attendance", href: isToday ? "/attendance" : `/attendance?date=${iso}` }, { label: label }]}
        title={`${classLabelLong(ref.grade, ref.section)} register`}
        description={`Class teacher ${teacher ? `${teacher.title} ${teacher.name}` : "not assigned"} · ${data.rows.length} students · ${fmtWeekdayLong(day)}`}
        actions={
          <>
            <SchoolDayPicker value={day} onChange={go} min={ay.start} max={today} />
            <Button
              variant="secondary"
              onClick={() => toast({ title: `${label} register downloading`, body: `${fmtWeekday(day)} plus the term-to-date summary, as PDF.`, tone: "info" })}
            >
              <Download /> Download
            </Button>
          </>
        }
      />

      <Tabs
        className="mb-4"
        value={tabs.some((t) => isoDate(t) === iso) ? iso : ""}
        onChange={(v) => go(tabs.find((t) => isoDate(t) === v)!)}
        tabs={tabs.map((t, i) => ({ value: isoDate(t), label: i === 0 ? `Today · ${fmtWeekday(t).split(",")[0]}` : fmtWeekday(t) }))}
      />

      {/* Summary strip */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line shadow-[var(--shadow-card)] sm:grid-cols-3 lg:grid-cols-6">
        {[
          { k: "Present", v: marked ? number(data.count.present) : "—", dot: MARK_META.P.dot },
          { k: "Late", v: marked ? number(data.count.late) : "—", dot: MARK_META.L.dot },
          { k: "Absent", v: marked ? number(data.count.absent) : "—", dot: MARK_META.A.dot },
          { k: "On leave", v: marked ? number(data.count.leave) : "—", dot: MARK_META.E.dot },
          { k: `Attendance ${isToday ? "today" : fmtWeekday(day).split(",")[0]}`, v: marked ? percent(data.count.rate) : "—" },
          { k: "Class average this term", v: percent(termRate) },
        ].map((x) => (
          <div key={x.k} className="bg-surface px-4 py-3">
            <dt className="flex items-center gap-1.5 truncate text-[12px] text-muted">
              {x.dot && <span className={cn("size-1.5 rounded-full", x.dot)} />}
              {x.k}
            </dt>
            <dd className="tnum mt-1 text-[18px] font-semibold text-ink">{x.v}</dd>
          </div>
        ))}
      </dl>

      {!marked && (
        <div className="mt-4 flex flex-col gap-3 rounded-[var(--radius-card)] border border-warn/25 bg-warn-soft/60 px-5 py-3.5 sm:flex-row sm:items-center">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-warn shadow-[var(--shadow-card)]">
            <ClipboardList className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-ink">{label} hasn&rsquo;t been marked yet</p>
            <p className="text-[12.5px] text-ink-2">
              Registers close at 9:30 am. {teacher ? `${teacher.title} ${teacher.lastName}` : "The class teacher"} was reminded once at 8:45 am.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="self-start sm:self-auto"
            onClick={() => toast({ title: "Reminder sent", body: `${teacher ? `${teacher.title} ${teacher.name}` : "The class teacher"} will get a push notification and SMS.` })}
          >
            <BellRing /> Nudge {teacher ? `${teacher.title} ${teacher.lastName}` : "teacher"}
          </Button>
        </div>
      )}

      <Card className="mt-4">
        <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[14px] font-semibold">Roster</h2>
            <p className="text-[12.5px] text-muted">
              {regMeta ? `Submitted at ${new Date(regMeta.submittedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }).toLowerCase()} by the class teacher` : marked ? "Submitted by the class teacher before 9:30 am" : "Marks will appear once the register is submitted"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Segmented
              size="sm"
              label="Filter roster"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "away", label: "Away", count: counts.away },
                { value: "L", label: "Late", count: counts.L },
              ]}
            />
            <SearchInput value={q} onChange={setQ} placeholder="Search name or roll no." className="sm:w-[220px]" />
          </div>
        </div>
        <Table>
          <THead>
            <tr>
              <Th className="w-12">Roll</Th>
              <Th>Student</Th>
              <Th>{isToday ? "Today" : fmtWeekday(day)}</Th>
              <Th className="hidden md:table-cell">Last 10 school days</Th>
              <Th align="right">Days away</Th>
              <Th className="w-[190px]">This term</Th>
            </tr>
          </THead>
          <tbody>
            {shown.map(({ s, mark, term }) => {
              const note = regMeta?.notes?.[s.id];
              const tone = rateTone(term.rate);
              return (
                <Tr key={s.id}>
                  <Td className="tnum text-muted">{String(s.roll).padStart(2, "0")}</Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={s.name} size={28} />
                      <div className="min-w-0">
                        <Link href={`/students/${s.id}`} className="block truncate font-medium hover:underline">
                          {s.name}
                        </Link>
                        <p className="truncate text-[12px] text-muted">{s.admissionNo}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-0.5">
                      <MarkBadge mark={mark as Mark | null} />
                      {note && <span className="max-w-[220px] truncate text-[12px] text-muted">“{note}”</span>}
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <MarkStrip student={s} days={data.strip} />
                  </Td>
                  <Td align="right" className="text-ink-2">
                    {term.absent + term.leave}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="w-20 shrink-0">
                        <Meter value={term.rate} tone={tone === "good" ? "brand" : tone} label={`${s.firstName}'s attendance this term`} />
                      </span>
                      <span className={cn("tnum text-[13px] font-semibold", tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink")}>{percent(term.rate)}</span>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
        {shown.length === 0 && (
          <EmptyState
            title={q ? `No student matches “${q}”` : filter === "L" ? "Nobody was late" : "Nobody was away"}
            body={q ? "Try a first name or a roll number." : `Every student in ${label} was in school${filter === "L" ? " on time" : ""}.`}
          />
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-[12px] text-muted">
          <span>Last 10 days:</span>
          {(["P", "L", "A", "E"] as Mark[]).map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5">
              <span className={cn("size-[9px] rounded-[2px]", MARK_META[m].dot, m === "P" && "opacity-35")} />
              {m === "E" ? "On leave" : MARK_META[m].label}
            </span>
          ))}
          <span className="ml-auto hidden sm:inline">Below 75% this term is flagged for CBSE eligibility</span>
        </div>
      </Card>
    </>
  );
}
