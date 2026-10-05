"use client";

import { ArrowRightLeft, Check, Download, UserRoundX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Segmented, Select } from "@/components/ui/forms";
import { PageHeader } from "@/components/ui/layout";
import { useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, Card, CardHeader, cn } from "@/components/ui/primitives";
import { currentSchoolDay, leaveRequests, staffOnLeave } from "@/lib/data/attendance";
import { isoDate } from "@/lib/data/calendar";
import { classTeacher, staffById, type Staff } from "@/lib/data/people";
import { CLASSES, classLabel, classLabelLong, GRADE_BY_ID, GRADES, PERIODS, TEACHING_PERIODS, WEEKDAYS } from "@/lib/data/school";
import { classTimetable, currentPeriodIndex, subjectName, teacherTimetable } from "@/lib/data/timetable";
import { fmtClock, fmtWeekdayLong, plural } from "@/lib/format";
import { setState, useAppState } from "@/lib/store";
import { busyIndex, cellSubject, labelOf, lessonsPerWeek, suggestSubstitute, teacherShort, timetabledStaff, tintFor, WeekGrid, type CellSpec } from "./shared";

type Mode = "class" | "teacher";

const TIMETABLED = CLASSES.filter((c) => GRADE_BY_ID[c.grade].stage !== "Pre-primary");

function stageKey(grade: string): Staff["teaches"][number] {
  const st = GRADE_BY_ID[grade as keyof typeof GRADE_BY_ID].stage;
  return st === "Primary" ? "primary" : st === "Senior secondary" ? "senior" : st === "Pre-primary" ? "pre" : "middle";
}

export function AdminTimetable() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const subs = useAppState((s) => s.substitutions);
  const leaveStore = useAppState((s) => s.leaveDecisions);
  const initialTeacher = params.get("teacher");
  const [mode, setMode] = useState<Mode>(initialTeacher ? "teacher" : "class");
  const [classKey, setClassKey] = useState(params.get("class") && TIMETABLED.some((c) => c.key === params.get("class")) ? params.get("class")! : "8-B");
  const teachers = useMemo(() => timetabledStaff().sort((a, b) => a.department.localeCompare(b.department) || a.firstName.localeCompare(b.firstName)), []);
  const [teacherId, setTeacherId] = useState(initialTeacher && teachers.some((t) => t.id === initialTeacher) ? initialTeacher : "T-KAVYA");

  const day = currentSchoolDay();
  const iso = isoDate(day);
  const now = new Date();
  const isToday = iso === isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const todayIdx = day.getDay() - 1;
  const current = isToday ? currentPeriodIndex(now) : null;

  useEffect(() => {
    const q = mode === "class" ? `?class=${classKey}` : `?teacher=${teacherId}`;
    router.replace(`/timetable${q}`, { scroll: false });
  }, [mode, classKey, teacherId, router]);

  // ——— substitutions for today ———
  const cover = useMemo(() => {
    const onLeave = staffOnLeave(day);
    const absentIds = new Set(onLeave.map((l) => l.staff.id));
    const idx = busyIndex();
    const rows: { leave: (typeof onLeave)[number]; periods: { p: number; classKey: string; subject: string; key: string; suggested: Staff | null; assigned: Staff | null }[] }[] = [];
    const takenAt = new Map<number, Set<string>>();
    for (const [k, v] of Object.entries(subs)) {
      const [d, , p] = k.split("|");
      if (d === iso) {
        if (!takenAt.has(Number(p))) takenAt.set(Number(p), new Set());
        takenAt.get(Number(p))!.add(v);
      }
    }
    for (const l of onLeave) {
      const grid = idx.get(l.staff.id);
      if (!grid || todayIdx < 0 || todayIdx > 4) continue;
      const periods = grid[todayIdx]
        .map((ck, p) => ({ ck, p }))
        .filter((x) => x.ck)
        .map(({ ck, p }) => {
          const slot = classTimetable(ck!)![todayIdx][p]!;
          const key = `${iso}|${l.staff.id}|${p}`;
          const assignedId = subs[key];
          const exclude = new Set([...absentIds, ...(takenAt.get(p) ?? [])]);
          const suggested = assignedId ? null : suggestSubstitute({ day: todayIdx, period: p, subject: slot.subject, stage: stageKey(ck!.split("-")[0]), exclude });
          if (suggested) {
            if (!takenAt.has(p)) takenAt.set(p, new Set());
            takenAt.get(p)!.add(suggested.id);
          }
          return { p, classKey: ck!, subject: slot.subject, key, suggested, assigned: assignedId ? (staffById(assignedId) ?? null) : null };
        });
      rows.push({ leave: l, periods });
    }
    return { rows, onLeave, absentIds };
  }, [subs, iso, todayIdx, leaveStore]);

  const totalCover = cover.rows.reduce((a, r) => a + r.periods.length, 0);
  const assignedCount = cover.rows.reduce((a, r) => a + r.periods.filter((p) => p.assigned).length, 0);

  const assign = (key: string, sub: Staff, what: string) => {
    setState((st) => ({ substitutions: { ...st.substitutions, [key]: sub.id } }));
    toast({ title: `${sub.title} ${sub.name} is covering ${what}`, body: "They've been notified on the app; the class sees the change on its timetable." });
  };
  const unassign = (key: string) =>
    setState((st) => {
      const next = { ...st.substitutions };
      delete next[key];
      return { substitutions: next };
    });
  const assignAll = () => {
    const add: Record<string, string> = {};
    cover.rows.forEach((r) => r.periods.forEach((p) => !p.assigned && p.suggested && (add[p.key] = p.suggested.id)));
    setState((st) => ({ substitutions: { ...st.substitutions, ...add } }));
    toast({ title: `${plural(Object.keys(add).length, "period")} covered`, body: "Substitute teachers have been notified on the app." });
  };

  // ——— grid cells ———
  const cells: CellSpec[][] = useMemo(() => {
    if (mode === "class") {
      const tt = classTimetable(classKey);
      const home = labelOf(classKey);
      return WEEKDAYS.map((_, d) =>
        TEACHING_PERIODS.map((__, p) => {
          const slot = tt?.[d][p];
          if (!slot) return null;
          const t = slot.teacherId ? staffById(slot.teacherId) : null;
          const absent = d === todayIdx && t && cover.absentIds.has(t.id);
          const subId = absent ? subs[`${iso}|${t!.id}|${p}`] : undefined;
          if (absent)
            return {
              variant: subId ? "cover" : "alert",
              title: cellSubject(slot.subject),
              sub: subId ? `Cover: ${teacherShort(staffById(subId))}` : "Cover needed",
              meta: subId ? `for ${teacherShort(t)}` : `${teacherShort(t)} on leave`,
            } as CellSpec;
          return { tint: tintFor(slot.subject), title: cellSubject(slot.subject), sub: t ? teacherShort(t) : slot.subject === "pe" ? "PE department" : "Library staff", meta: slot.room !== home ? slot.room : undefined };
        }),
      );
    }
    const tt = teacherTimetable(teacherId);
    return WEEKDAYS.map((_, d) =>
      TEACHING_PERIODS.map((__, p) => {
        const slot = tt[d][p];
        if (!slot) {
          const coverFor = d === todayIdx ? Object.entries(subs).find(([k, v]) => v === teacherId && k.startsWith(`${iso}|`) && Number(k.split("|")[2]) === p) : undefined;
          if (coverFor) {
            const [, absentId] = coverFor[0].split("|");
            const ck = busyIndex().get(absentId)?.[d][p];
            const s = ck ? classTimetable(ck)?.[d][p] : null;
            return { variant: "cover", title: `Cover · ${ck ? labelOf(ck) : ""}`, sub: s ? cellSubject(s.subject) : undefined, meta: `for ${teacherShort(staffById(absentId))}` } as CellSpec;
          }
          return { variant: "free", title: "Free" } as CellSpec;
        }
        const lbl = labelOf(slot.classKey);
        return { tint: tintFor(slot.subject), title: lbl, sub: cellSubject(slot.subject), meta: slot.room !== lbl ? slot.room : undefined };
      }),
    );
  }, [mode, classKey, teacherId, subs, iso, todayIdx, cover.absentIds]);

  const legend = useMemo(() => {
    if (mode !== "class") return [];
    const tt = classTimetable(classKey);
    const counts = new Map<string, number>();
    tt?.flat().forEach((s) => s && counts.set(s.subject, (counts.get(s.subject) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [mode, classKey]);

  const ref = CLASSES.find((c) => c.key === classKey)!;
  const ct = classTeacher(classKey);
  const teacher = staffById(teacherId);
  const load = lessonsPerWeek(teacherId);
  const teacherClasses = useMemo(() => [...new Set(teacherTimetable(teacherId).flat().filter(Boolean).map((s) => s!.classKey))], [teacherId]);
  const pendingLeave = leaveRequests().filter((l) => l.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Timetable"
        description={`Classes I–XII · eight periods, ${fmtClock(PERIODS[0].start)} – ${fmtClock(PERIODS[PERIODS.length - 1].end)}. Pre-primary follows its own activity schedule.`}
        actions={
          <>
            <Segmented
              label="View"
              value={mode}
              onChange={setMode}
              options={[
                { value: "class", label: "Class view" },
                { value: "teacher", label: "Teacher view" },
              ]}
            />
            {mode === "class" ? (
              <Select value={classKey} onChange={(e) => setClassKey(e.target.value)} aria-label="Class">
                {GRADES.filter((g) => g.stage !== "Pre-primary").map((g) => (
                  <optgroup key={g.id} label={g.label}>
                    {g.sections.map((s) => (
                      <option key={s} value={`${g.id}-${s}`}>
                        {classLabelLong(g.id, s)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            ) : (
              <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="Teacher" className="max-w-[260px]">
                {[...new Set(teachers.map((t) => t.department))].map((dep) => (
                  <optgroup key={dep} label={dep}>
                    {teachers
                      .filter((t) => t.department === dep)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} {t.name} · {t.designation}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            )}
            <Button
              variant="secondary"
              size="icon"
              aria-label="Download timetable"
              onClick={() =>
                toast({
                  title: "Timetable PDF is being prepared",
                  body: mode === "class" ? `${classLabelLong(ref.grade, ref.section)} — A4, ready to pin on the class notice board.` : `${teacher?.title} ${teacher?.name}'s week, A4.`,
                  tone: "info",
                })
              }
            >
              <Download />
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader
            title={mode === "class" ? classLabelLong(ref.grade, ref.section) : `${teacher?.title} ${teacher?.name}`}
            description={
              mode === "class"
                ? `Class teacher ${ct ? `${ct.title} ${ct.name}` : "—"} · 40 periods a week`
                : `${teacher?.designation} · ${load} of 40 periods · ${teacherClasses.map(labelOf).join(", ")}`
            }
          />
          <div className="px-3 pb-4 sm:px-4">
            <WeekGrid cells={cells} today={todayIdx >= 0 && todayIdx < 5 ? todayIdx : null} current={current} ariaLabel={mode === "class" ? "Class timetable" : "Teacher timetable"} />
          </div>
          {mode === "class" && (
            <ul className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line px-5 py-3 text-[12px] text-ink-2">
              {legend.map(([s, n]) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span className="h-3 w-1.5 rounded-sm" style={{ background: tintFor(s).edge }} />
                  {subjectName(s)}
                  <span className="tnum text-muted">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Substitutions today"
            icon={<ArrowRightLeft />}
            description={`${fmtWeekdayLong(day)} · ${totalCover ? `${assignedCount} of ${plural(totalCover, "period")} covered` : "no lessons to cover"}`}
            action={
              totalCover > assignedCount ? (
                <Button size="sm" variant="secondary" onClick={assignAll}>
                  Assign all
                </Button>
              ) : undefined
            }
          />
          <div className="border-t border-line">
            {cover.onLeave.map((l) => {
              const row = cover.rows.find((r) => r.leave.id === l.id);
              const teaches = row && row.periods.length > 0;
              return (
                <section key={l.id} className="border-b border-line px-5 py-3.5 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <Avatar name={l.staff.name} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{`${l.staff.title} ${l.staff.name}`}</p>
                      <p className="truncate text-[12px] text-muted">{l.staff.designation}</p>
                    </div>
                    <Badge>{l.type} leave</Badge>
                  </div>
                  {teaches ? (
                    <ul className="mt-3 flex flex-col gap-2">
                      {row!.periods.map((p) => {
                        const lbl = labelOf(p.classKey);
                        const what = `P${p.p + 1} ${lbl} ${subjectName(p.subject)}`;
                        return (
                          <li key={p.key} className={cn("rounded-lg border px-3 py-2", p.assigned ? "border-line bg-surface-2" : "border-line")}>
                            <div className="flex items-center justify-between gap-2 text-[12.5px]">
                              <span className="min-w-0 truncate">
                                <span className="font-semibold text-ink">P{p.p + 1}</span>
                                <span className="text-muted"> · {fmtClock(TEACHING_PERIODS[p.p].start)} · </span>
                                <span className="font-medium text-ink">{lbl}</span>
                                <span className="text-ink-2"> {subjectName(p.subject)}</span>
                              </span>
                            </div>
                            {p.assigned ? (
                              <div className="mt-1.5 flex items-center justify-between gap-2">
                                <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-good">
                                  <Check className="size-3.5 shrink-0" />
                                  <span className="truncate">{`${p.assigned.title} ${p.assigned.name}`}</span>
                                </span>
                                <button type="button" onClick={() => unassign(p.key)} className="shrink-0 text-[12px] font-medium text-muted hover:text-ink">
                                  Undo
                                </button>
                              </div>
                            ) : p.suggested ? (
                              <div className="mt-1.5 flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate text-[12px] text-muted">
                                  Free: <span className="text-ink-2">{`${p.suggested.title} ${p.suggested.name}`}</span>
                                  {p.suggested.subjects.includes(p.subject) ? " · same subject" : ` · ${p.suggested.department}`}
                                </span>
                                <Button size="sm" variant="subtle" className="h-7 shrink-0" onClick={() => assign(p.key, p.suggested!, what)}>
                                  Assign
                                </Button>
                              </div>
                            ) : (
                              <p className="mt-1.5 text-[12px] text-bad">No free teacher this period — merge with the parallel section.</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 flex items-center gap-1.5 pl-[42px] text-[12px] text-muted">
                      <UserRoundX className="size-3.5" /> No lessons today{l.staff.category !== "Teaching" ? " — non-teaching staff" : ""}
                    </p>
                  )}
                </section>
              );
            })}
            {cover.onLeave.length === 0 && <p className="px-5 py-4 text-[13px] text-muted">Every teacher is in today.</p>}
          </div>
          {pendingLeave > 0 && (
            <p className="border-t border-line px-5 py-3 text-[12px] text-muted">
              {plural(pendingLeave, "leave request")} awaiting approval may add more cover.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
