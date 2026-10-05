"use client";

import { ChevronRight, ClipboardCheck, Download, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { SearchInput } from "@/components/ui/forms";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, ButtonLink, Card, CardHeader, cn, Meter } from "@/components/ui/primitives";
import { SortTh, Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { classDay, currentSchoolDay, isMarked, studentSummary } from "@/lib/data/attendance";
import { academicYear, isoDate, schoolDaysBetween } from "@/lib/data/calendar";
import { classResults, latestExam, reportCard } from "@/lib/data/exams";
import { PERSONA_TEACHER_ID, studentsInClass } from "@/lib/data/people";
import { CLASSES, GRADE_BY_ID, classLabel, classLabelLong } from "@/lib/data/school";
import { teacherTimetable } from "@/lib/data/timetable";
import { number, percent } from "@/lib/format";
import { useTeacher } from "@/lib/session";
import { useAppState } from "@/lib/store";
import { downloadCsv, HouseTag } from "./shared";

type SortKey = "roll" | "name" | "att" | "maths" | "overall";

/** Classes a teacher meets in the week, own class first. */
export function teacherClasses(teacherId: string, own: string | null) {
  const periods = new Map<string, number>();
  teacherTimetable(teacherId).forEach((day) => day.forEach((slot) => slot && periods.set(slot.classKey, (periods.get(slot.classKey) ?? 0) + 1)));
  if (own && !periods.has(own)) periods.set(own, 0);
  const order = (k: string) => GRADE_BY_ID[k.split("-")[0] as keyof typeof GRADE_BY_ID].order;
  return [...periods.entries()]
    .map(([key, n]) => ({ key, periods: n }))
    .sort((a, b) => (a.key === own ? -1 : b.key === own ? 1 : order(a.key) - order(b.key) || a.key.localeCompare(b.key)));
}

export function TeacherStudents() {
  const teacher = useTeacher();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const attendanceStore = useAppState((s) => s.attendance);
  const day = currentSchoolDay();
  const ay = academicYear(day);
  const exam = latestExam();

  const classes = useMemo(() => teacherClasses(PERSONA_TEACHER_ID, teacher.classTeacherOf), [teacher.classTeacherOf]);
  const requested = params.get("class");
  const [active, setActive] = useState(() => (requested && classes.some((c) => c.key === requested) ? requested : classes[0]?.key));
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "roll", dir: "asc" });

  const days = useMemo(() => schoolDaysBetween(ay.start, day), [ay.start, day]);

  const tiles = useMemo(
    () =>
      classes.map((c) => {
        const ref = CLASSES.find((x) => x.key === c.key)!;
        const list = studentsInClass(c.key);
        const today = classDay(c.key, day);
        const marked = isMarked(c.key, day);
        const cr = classResults(c.key, exam);
        const mi = cr?.subjects.findIndex((s) => s.id === "mat") ?? -1;
        return { ...c, ref, list, today, marked, mathsAvg: cr && mi >= 0 ? cr.subjectStats[mi].avgPct : null };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classes, attendanceStore, day.getTime(), exam],
  );

  const tile = tiles.find((t) => t.key === active) ?? tiles[0];
  const own = tile?.key === teacher.classTeacherOf;

  const rows = useMemo(() => {
    if (!tile) return [];
    return tile.list.map((s) => {
      const att = studentSummary(s, days);
      const rc = reportCard(s, exam);
      const maths = rc?.rows.find((r) => r.subject.id === "mat") ?? null;
      return { s, att, maths, overall: rc?.pct ?? null, grade: rc?.grade ?? null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tile, days, exam, attendanceStore]);

  const classStats = useMemo(() => {
    const rate = rows.reduce((a, r) => a + r.att.rate, 0) / (rows.length || 1);
    const low = rows.filter((r) => r.att.rate < 0.85).length;
    const girls = rows.filter((r) => r.s.gender === "F").length;
    // grade-wide maths average for context
    const gradeId = tile?.ref.grade;
    const peers = gradeId
      ? GRADE_BY_ID[gradeId].sections
          .map((sec) => classResults(`${gradeId}-${sec}`, exam))
          .filter(Boolean)
          .map((cr) => {
            const i = cr!.subjects.findIndex((s) => s.id === "mat");
            return i >= 0 ? cr!.subjectStats[i].avgPct : null;
          })
          .filter((x): x is number => x !== null)
      : [];
    const gradeMaths = peers.length ? peers.reduce((a, b) => a + b, 0) / peers.length : null;
    return { rate, low, girls, gradeMaths };
  }, [rows, tile, exam]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter(
      (r) => !needle || r.s.name.toLowerCase().includes(needle) || r.s.admissionNo.toLowerCase().includes(needle) || r.s.guardians.some((g) => g.name.toLowerCase().includes(needle)),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sort.key) {
        case "name":
          return dir * a.s.name.localeCompare(b.s.name);
        case "att":
          return dir * (a.att.rate - b.att.rate);
        case "maths":
          return dir * ((a.maths?.pct ?? -1) - (b.maths?.pct ?? -1));
        case "overall":
          return dir * ((a.overall ?? -1) - (b.overall ?? -1));
        default:
          return dir * (a.s.roll - b.s.roll);
      }
    });
    return list;
  }, [rows, q, sort]);

  const onSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "roll" || k === "name" ? "asc" : "desc" }));

  if (!tile) {
    return (
      <>
        <PageHeader title="My students" />
        <Card>
          <EmptyState title="No classes on your timetable yet" body="Once the coordinator assigns your sections, your students will appear here." />
        </Card>
      </>
    );
  }

  const totalStudents = tiles.reduce((a, t) => a + t.list.length, 0);

  const exportCsv = () => {
    const header = ["Roll", "Student", "Admission no.", "Gender", "Attendance (AY to date)", "Days absent", `Maths · ${exam.short} (/${exam.max})`, `Overall · ${exam.short} (%)`, "Parent", "Mobile"];
    downloadCsv(
      `${classLabel(tile.ref.grade, tile.ref.section).toLowerCase()}-class-list-${isoDate(new Date())}.csv`,
      header,
      [...rows]
        .sort((a, b) => a.s.roll - b.s.roll)
        .map((r) => [
          r.s.roll, r.s.name, r.s.admissionNo, r.s.gender === "F" ? "F" : "M", (r.att.rate * 100).toFixed(1) + "%", r.att.absent, r.maths?.marks ?? "", r.overall?.toFixed(1) ?? "", r.s.guardians[0].name, r.s.guardians[0].phone,
        ]),
    );
    toast({ title: `${classLabel(tile.ref.grade, tile.ref.section)} class list downloaded`, body: `${rows.length} students with attendance and ${exam.short} marks.` });
  };

  return (
    <>
      <PageHeader
        title="My students"
        description={`${number(totalStudents)} students across the ${tiles.length} sections you teach · Mathematics · AY ${ay.label}`}
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <Download /> Export class list
          </Button>
        }
      />

      {/* Class switcher */}
      <div role="radiogroup" aria-label="Class" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const selected = t.key === tile.key;
          const isOwn = t.key === teacher.classTeacherOf;
          return (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setActive(t.key);
                setQ("");
                router.replace(`/students?class=${t.key}`, { scroll: false });
              }}
              className={cn(
                "rounded-[var(--radius-card)] border bg-surface p-4 text-left shadow-[var(--shadow-card)] transition-[border-color,box-shadow]",
                selected ? "border-brand shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_13%,transparent)]" : "border-line hover:border-line-strong",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="title-serif text-[22px] leading-none font-semibold text-ink">{classLabel(t.ref.grade, t.ref.section)}</span>
                {isOwn ? <Badge tone="brand">Class teacher</Badge> : <span className="tnum pt-0.5 text-[11.5px] text-muted">{t.periods} periods/wk</span>}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-[12px] text-muted">
                <span className="tnum">{t.list.length} students</span>
                {t.marked ? (
                  <span className="tnum">{percent(t.today.rate, 0)} present today</span>
                ) : (
                  <span className="font-medium text-warn">Register not marked</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title={`${classLabelLong(tile.ref.grade, tile.ref.section)} · ${tile.list.length} students`}
          description={own ? `You're the class teacher · ${tile.periods} Maths periods a week` : `You teach Mathematics · ${tile.periods} periods a week`}
          action={
            !tile.marked && own ? (
              <ButtonLink href="/attendance" size="sm" variant="primary">
                <ClipboardCheck /> Mark today&apos;s register
              </ButtonLink>
            ) : undefined
          }
        />
        <div className="grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-4">
          <MiniStat label="Attendance this year" value={percent(classStats.rate)} sub={`${days.length} school days`} />
          <MiniStat
            label="Below 85%"
            value={String(classStats.low)}
            sub={classStats.low ? "need a call home" : "no one at risk"}
            tone={classStats.low ? "warn" : undefined}
          />
          <MiniStat
            label={`Maths average · ${exam.short}`}
            value={tile.mathsAvg !== null ? `${tile.mathsAvg.toFixed(1)}%` : "—"}
            sub={classStats.gradeMaths !== null && tile.mathsAvg !== null ? `${tile.mathsAvg >= classStats.gradeMaths ? "+" : "−"}${Math.abs(tile.mathsAvg - classStats.gradeMaths).toFixed(1)} pts vs ${GRADE_BY_ID[tile.ref.grade].label}` : undefined}
          />
          <MiniStat label="Boys · Girls" value={`${tile.list.length - classStats.girls} · ${classStats.girls}`} sub={`${tile.list.filter((s) => s.routeId).length} on the school bus`} />
        </div>
        <div className="px-4 py-3 sm:px-5">
          <SearchInput value={q} onChange={setQ} placeholder={`Search ${classLabel(tile.ref.grade, tile.ref.section)} by name or parent`} className="max-w-[360px]" />
        </div>

        {visible.length === 0 ? (
          <div className="border-t border-line">
            <EmptyState icon={<SearchX />} title="No one by that name" body={`Nobody in ${classLabel(tile.ref.grade, tile.ref.section)} matches “${q}”.`} />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <tr>
                    <SortTh label="Roll" k="roll" sort={sort} onSort={onSort} className="w-16" />
                    <SortTh label="Student" k="name" sort={sort} onSort={onSort} />
                    <SortTh label="Attendance" k="att" sort={sort} onSort={onSort} />
                    <SortTh label={`Maths · ${exam.short}`} k="maths" sort={sort} onSort={onSort} align="right" />
                    <SortTh label="Overall" k="overall" sort={sort} onSort={onSort} align="right" />
                    <Th className="hidden lg:table-cell">Parent</Th>
                    <Th className="w-8">
                      <span className="sr-only">Open</span>
                    </Th>
                  </tr>
                </THead>
                <tbody>
                  {visible.map((r) => (
                    <Tr key={r.s.id} onClick={() => router.push(`/students/${r.s.id}`)} className="group">
                      <Td className="tnum text-muted">{r.s.roll}</Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.s.name} size={30} />
                          <div className="min-w-0">
                            <Link href={`/students/${r.s.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-ink hover:underline">
                              {r.s.name}
                            </Link>
                            <HouseTag house={r.s.house} className="text-[12px] text-muted" />
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <AttendanceCell rate={r.att.rate} absent={r.att.absent} />
                      </Td>
                      <Td align="right">
                        {r.maths ? (
                          <span>
                            <span className="font-medium text-ink">{r.maths.marks}</span>
                            <span className="text-muted">/{r.maths.max}</span>
                            <span className="ml-2 inline-block w-6 text-left text-[12px] text-muted">{r.maths.grade}</span>
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </Td>
                      <Td align="right">{r.overall !== null ? <span className="text-ink-2">{r.overall.toFixed(1)}%</span> : <span className="text-faint">—</span>}</Td>
                      <Td className="hidden lg:table-cell">
                        <span className="block max-w-[200px] truncate text-ink-2">{r.s.guardians[0].name}</span>
                        <span className="tnum block text-[12px] text-muted">{r.s.guardians[0].phone}</span>
                      </Td>
                      <Td className="text-faint">
                        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-muted" aria-hidden />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <ul className="border-t border-line md:hidden">
              {visible.map((r) => (
                <li key={r.s.id} className="border-b border-line last:border-b-0">
                  <Link href={`/students/${r.s.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                    <span className="tnum w-5 text-[12px] text-muted">{r.s.roll}</span>
                    <Avatar name={r.s.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{r.s.name}</span>
                      <span className="tnum block text-[12px] text-muted">
                        Maths {r.maths ? `${r.maths.marks}/${r.maths.max}` : "—"} · {r.s.guardians[0].name.split(" ")[0]}
                      </span>
                    </div>
                    <span className={cn("tnum text-[13px] font-semibold", r.att.rate < 0.85 ? "text-bad" : "text-ink")}>{percent(r.att.rate, 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-5 py-3 text-[12.5px] text-muted">
              Attendance is for AY {ay.label} to date. Marks are from the {exam.name}.
            </div>
          </>
        )}
      </Card>
    </>
  );
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3 sm:px-5">
      <div className="truncate text-[12px] text-muted">{label}</div>
      <div className={cn("tnum mt-0.5 text-[18px] font-semibold", tone === "warn" ? "text-warn" : "text-ink")}>{value}</div>
      {sub && <div className="truncate text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

function AttendanceCell({ rate, absent }: { rate: number; absent: number }) {
  const tone = rate < 0.75 ? "bad" : rate < 0.85 ? "warn" : "good";
  return (
    <div className="flex items-center gap-3">
      <span className={cn("tnum w-12 font-medium", tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink")}>{(rate * 100).toFixed(1)}%</span>
      <Meter value={rate} tone={tone === "good" ? "brand" : tone} className="hidden w-20 xl:block" label="Attendance" />
      <span className="tnum hidden text-[12px] whitespace-nowrap text-muted lg:inline">{absent} absent</span>
    </div>
  );
}

