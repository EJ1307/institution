"use client";

import { CheckCircle2, ChevronRight, MessageSquareText, PencilLine, RotateCcw, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/forms";
import { PageHeader } from "@/components/ui/layout";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, ButtonLink, Card, CardHeader, cn, Meter } from "@/components/ui/primitives";
import { classDay, currentSchoolDay, isMarked, markFor, saveRegister, type Mark } from "@/lib/data/attendance";
import { isoDate, schoolDaysBack } from "@/lib/data/calendar";
import { studentsInClass, type Student } from "@/lib/data/people";
import { classLabel, CLASSES } from "@/lib/data/school";
import { fmtTime, fmtWeekday, fmtWeekdayLong, number, percent, plural } from "@/lib/format";
import { useTeacher } from "@/lib/session";
import { setState, useAppState } from "@/lib/store";
import { MARK_META, MARKS, rateTone, termSummaryCached } from "./shared";

const TOGGLE_ON: Record<Mark, string> = {
  P: "bg-good text-white border-good shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]",
  A: "bg-bad text-white border-bad shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]",
  L: "bg-[#C98A17] text-white border-[#C98A17] shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]",
  E: "bg-info text-white border-info shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]",
};

const TOGGLE_LABEL: Record<Mark, string> = { P: "P", A: "A", L: "L", E: "Leave" };

export function TeacherAttendance() {
  const teacher = useTeacher();
  const toast = useToast();
  const classKey = teacher.classTeacherOf ?? "8-B";
  const ref = CLASSES.find((c) => c.key === classKey)!;
  const label = classLabel(ref.grade, ref.section);
  const day = currentSchoolDay();
  const iso = isoDate(day);
  const regKey = `${classKey}|${iso}`;

  const attendanceStore = useAppState((s) => s.attendance);
  const metaStore = useAppState((s) => s.registerMeta);
  const saved = attendanceStore[regKey];
  const meta = metaStore[regKey];
  const submitted = isMarked(classKey, day);

  const roster = useMemo(() => studentsInClass(classKey), [classKey]);
  const termRates = useMemo(() => new Map(roster.map((s) => [s.id, termSummaryCached(s, day)])), [roster, iso, attendanceStore]);

  const [editing, setEditing] = useState(false);
  const [marks, setMarks] = useState<Record<string, Mark | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<Date | null>(null);

  const showForm = !submitted || editing;

  const startEdit = () => {
    setMarks(Object.fromEntries(roster.map((s) => [s.id, saved?.[s.id] ?? markFor(s, day)])));
    setNotes({ ...(meta?.notes ?? {}) });
    setEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const set = (id: string, m: Mark) => setMarks((x) => ({ ...x, [id]: x[id] === m ? null : m }));
  const counts = useMemo(() => {
    const c = { P: 0, A: 0, L: 0, E: 0, none: 0 };
    for (const s of roster) {
      const m = marks[s.id];
      if (m) c[m]++;
      else c.none++;
    }
    return c;
  }, [marks, roster]);
  const anyMarked = counts.none < roster.length;

  const markRest = () => setMarks((x) => Object.fromEntries(roster.map((s) => [s.id, x[s.id] ?? "P"])));

  const submit = () => {
    const final = Object.fromEntries(roster.map((s) => [s.id, marks[s.id]!])) as Record<string, Mark>;
    const keptNotes = Object.fromEntries(Object.entries(notes).filter(([id, n]) => n.trim() && (final[id] === "A" || final[id] === "E")).map(([id, n]) => [id, n.trim()]));
    saveRegister(classKey, day, final);
    setState((st) => ({ registerMeta: { ...st.registerMeta, [regKey]: { submittedAt: new Date().toISOString(), notes: keptNotes } } }));
    const wasEditing = editing;
    setEditing(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const away = counts.A;
    toast({
      title: wasEditing ? `${label} register updated` : `${label} register submitted`,
      body: away ? `Parents of ${plural(away, "absent student")} will be informed by SMS. The principal's dashboard is updated.` : "No absences today. The principal's dashboard is updated.",
    });
  };

  const recent = useMemo(() => schoolDaysBack(6, day).reverse().map((d) => ({ d, c: classDay(classKey, d), marked: isMarked(classKey, d) })), [classKey, iso, attendanceStore]);
  const watch = useMemo(
    () =>
      roster
        .map((s) => ({ s, t: termRates.get(s.id)! }))
        .filter((x) => x.t.rate < 0.85)
        .sort((a, b) => a.t.rate - b.t.rate),
    [roster, termRates],
  );

  return (
    <>
      <PageHeader
        eyebrow={`${fmtWeekdayLong(day)} · Class teacher, ${label}`}
        title={showForm ? (editing ? `Edit today's register` : `Mark today's register`) : `Today's register`}
        description={
          showForm
            ? `${roster.length} students in ${label}. Registers close at 9:30 am; absent students' parents are sent an SMS at 10:00 am.`
            : `Submitted${meta ? ` at ${fmtTime(new Date(meta.submittedAt))}` : ""}. You can still correct it until the end of the school day.`
        }
        actions={
          editing ? (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              <RotateCcw /> Discard changes
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          {showForm ? (
            <RegisterForm
              label={label}
              roster={roster}
              marks={marks}
              notes={notes}
              counts={counts}
              termRates={termRates}
              anyMarked={anyMarked}
              onSet={set}
              onNote={(id, v) => setNotes((n) => ({ ...n, [id]: v }))}
              onMarkRest={markRest}
              onClear={() => (setMarks({}), setNotes({}))}
              onSubmit={submit}
              editing={editing}
            />
          ) : (
            <Submitted label={label} classKey={classKey} day={day} roster={roster} notes={meta?.notes ?? {}} submittedAt={meta?.submittedAt} onEdit={startEdit} />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title={`Recent registers · ${label}`} description="Last six school days" />
            <ul className="border-t border-line">
              {recent.map(({ d, c, marked }, i) => (
                <li key={d.getTime()} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    disabled={!marked}
                    onClick={() => setSheet(d)}
                    className="grid w-full grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-2.5 text-left transition-colors enabled:hover:bg-surface-2 disabled:cursor-default"
                  >
                    <span className="text-[13px] font-medium text-ink">{i === 0 ? "Today" : fmtWeekday(d).split(",")[0] + ", " + d.getDate()}</span>
                    {marked ? (
                      <span className="flex items-center gap-2 text-[12px] text-muted">
                        <Meter value={c.rate} tone={c.rate < 0.85 ? "warn" : "brand"} className="w-16 shrink-0" label={`Attendance ${fmtWeekday(d)}`} />
                        <span className="tnum truncate">
                          {c.present + c.late}/{c.total} · {c.absent + c.leave} away
                        </span>
                      </span>
                    ) : (
                      <span className="text-[12px] text-warn">Not submitted yet</span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="tnum text-[13px] font-semibold text-ink">{marked ? percent(c.rate, 0) : ""}</span>
                      {marked && <ChevronRight className="size-3.5 text-faint" aria-hidden />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Attendance to watch" description={`${label} · under 85% since 1 April`} icon={<UsersRound />} />
            {watch.length ? (
              <ul className="border-t border-line px-5 py-1">
                {watch.map(({ s, t }) => {
                  const tone = rateTone(t.rate);
                  return (
                    <li key={s.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                      <Avatar name={s.name} size={30} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/students/${s.id}`} className="block truncate text-[13px] font-medium hover:underline">
                          {s.name}
                        </Link>
                        <p className="truncate text-[12px] text-muted">
                          {t.absent} absent · {t.leave} leave · roll {s.roll}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("tnum text-[13px] font-semibold", tone === "bad" ? "text-bad" : "text-warn")}>{percent(t.rate)}</p>
                        {tone === "bad" && <p className="text-[11px] text-bad">Below 75%</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-t border-line px-5 py-4 text-[13px] text-muted">Everyone in {label} is above 85% this term.</p>
            )}
            <p className="border-t border-line px-5 py-3 text-[12px] text-muted">CBSE needs 75% to sit the board exams in Class X. Early calls home help.</p>
          </Card>
        </div>
      </div>

      <PastRegister classKey={classKey} label={label} day={sheet} onClose={() => setSheet(null)} />
    </>
  );
}

// ——— The register form ——————————————————————————————————————————————

function RegisterForm({
  label,
  roster,
  marks,
  notes,
  counts,
  termRates,
  anyMarked,
  onSet,
  onNote,
  onMarkRest,
  onClear,
  onSubmit,
  editing,
}: {
  label: string;
  roster: Student[];
  marks: Record<string, Mark | null>;
  notes: Record<string, string>;
  counts: Record<Mark | "none", number>;
  termRates: Map<string, { rate: number }>;
  anyMarked: boolean;
  onSet: (id: string, m: Mark) => void;
  onNote: (id: string, v: string) => void;
  onMarkRest: () => void;
  onClear: () => void;
  onSubmit: () => void;
  editing: boolean;
}) {
  const total = roster.length;
  const done = total - counts.none;
  const rate = done ? (counts.P + counts.L) / done : 0;
  return (
    <Card className="overflow-visible">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold">
            {label} · {total} students
          </h2>
          <ul className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] text-muted" aria-live="polite">
            {MARKS.map((m) => (
              <li key={m} className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", MARK_META[m].dot)} />
                {m === "E" ? "Leave" : MARK_META[m].label}
                <span className="tnum font-semibold text-ink">{counts[m]}</span>
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full border border-faint" />
              Unmarked <span className="tnum font-semibold text-ink">{counts.none}</span>
            </li>
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {anyMarked && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          )}
          <Button variant="secondary" onClick={onMarkRest} disabled={counts.none === 0}>
            <CheckCircle2 /> {anyMarked ? "Mark the rest present" : "Mark all present"}
          </Button>
        </div>
      </div>

      <ol>
        {roster.map((s) => {
          const m = marks[s.id] ?? null;
          const t = termRates.get(s.id)!;
          const tone = rateTone(t.rate);
          const away = m === "A" || m === "E";
          return (
            <li
              key={s.id}
              className={cn(
                "border-b border-line px-4 py-3 transition-colors last:border-b-0 sm:px-5",
                m === "A" && "bg-bad-soft/45",
                m === "E" && "bg-info-soft/45",
                m === "L" && "bg-warn-soft/40",
              )}
            >
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="tnum w-5 shrink-0 text-[12px] text-faint">{String(s.roll).padStart(2, "0")}</span>
                  <span className="hidden sm:block">
                    <Avatar name={s.name} size={34} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{s.name}</p>
                    <p className={cn("truncate text-[12px]", tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-muted")}>
                      {percent(t.rate, 0)} this term{tone === "bad" ? " · below 75%" : ""}
                    </p>
                  </div>
                </div>
                <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="grid shrink-0 grid-cols-4 gap-1.5 pl-8 sm:flex sm:pl-0">
                  {MARKS.map((k) => {
                    const on = m === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={`${MARK_META[k].label}`}
                        title={MARK_META[k].label}
                        onClick={() => onSet(s.id, k)}
                        className={cn(
                          "h-11 rounded-lg border text-[13.5px] font-semibold transition-[background-color,border-color,color] duration-100 select-none",
                          k === "E" ? "text-[12.5px] sm:w-[58px]" : "sm:w-11",
                          on ? TOGGLE_ON[k] : "border-line-strong/80 bg-surface text-muted hover:border-line-strong hover:text-ink active:bg-surface-2",
                        )}
                      >
                        {TOGGLE_LABEL[k]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {away && (
                <div className="mt-2.5 flex items-center gap-2 pl-8 sm:pl-[78px]">
                  <MessageSquareText className="size-4 shrink-0 text-faint" aria-hidden />
                  <Input
                    value={notes[s.id] ?? ""}
                    onChange={(e) => onNote(s.id, e.target.value)}
                    placeholder={m === "E" ? "Leave reason, e.g. family wedding in Jaipur (optional)" : "Note, e.g. fever — mother called at 8:10 (optional)"}
                    aria-label={`Note for ${s.name}`}
                    className="h-8 text-[13px]"
                    maxLength={120}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Sticky submit bar */}
      <div className="sticky bottom-0 z-10 rounded-b-[var(--radius-card)] border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="font-medium text-ink">
                <span className="tnum">{done}</span> of <span className="tnum">{total}</span> marked
              </span>
              <span className="tnum hidden text-muted sm:inline">{done ? `${percent(rate)} in school` : "—"}</span>
            </div>
            <Meter value={done / total} className="mt-1.5" label="Register progress" tone={counts.none ? "brand" : "good"} />
            <p className="mt-1.5 truncate text-[12px] text-muted">
              {counts.none ? `Mark ${plural(counts.none, "more student")} to submit` : `${counts.A} absent · ${counts.L} late · ${counts.E} on leave`}
            </p>
          </div>
          <Button variant="primary" size="lg" disabled={counts.none > 0} onClick={onSubmit} className="shrink-0">
            {editing ? "Save changes" : "Submit register"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ——— After submission ———————————————————————————————————————————————

function Submitted({
  label,
  classKey,
  day,
  roster,
  notes,
  submittedAt,
  onEdit,
}: {
  label: string;
  classKey: string;
  day: Date;
  roster: Student[];
  notes: Record<string, string>;
  submittedAt?: string;
  onEdit: () => void;
}) {
  const attendanceStore = useAppState((s) => s.attendance);
  const c = useMemo(() => classDay(classKey, day), [classKey, day, attendanceStore]);
  const away = roster.map((s) => ({ s, m: markFor(s, day) })).filter((x) => x.m && x.m !== "P");
  const now = new Date();
  const smsSent = now.getHours() * 60 + now.getMinutes() >= 600;
  const absentCount = c.absent;

  return (
    <Card>
      <div className="flex flex-col gap-4 px-5 pt-6 pb-5 sm:flex-row sm:items-start">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-good-soft text-good">
          <CheckCircle2 className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="title-serif text-[22px] leading-tight font-semibold">{label} is marked for today</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            {submittedAt ? `Submitted at ${fmtTime(new Date(submittedAt))}. ` : ""}
            The principal&rsquo;s dashboard is up to date.{" "}
            {absentCount ? (smsSent ? `Parents of ${plural(absentCount, "absent student")} have been sent an SMS.` : `Parents of ${plural(absentCount, "absent student")} get an SMS at 10:00 am.`) : "No absences to report to parents."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={onEdit}>
            <PencilLine /> Edit register
          </Button>
        </div>
      </div>

      <dl className="mx-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
        {[
          { k: "Present", v: c.present, dot: MARK_META.P.dot },
          { k: "Late", v: c.late, dot: MARK_META.L.dot },
          { k: "Absent", v: c.absent, dot: MARK_META.A.dot },
          { k: "On leave", v: c.leave, dot: MARK_META.E.dot },
        ].map((x) => (
          <div key={x.k} className="bg-surface px-4 py-3">
            <dt className="flex items-center gap-1.5 text-[12px] text-muted">
              <span className={cn("size-1.5 rounded-full", x.dot)} />
              {x.k}
            </dt>
            <dd className="tnum mt-1 text-[18px] font-semibold text-ink">{number(x.v)}</dd>
          </div>
        ))}
        <div className="col-span-2 bg-surface px-4 py-3 sm:col-span-1">
          <dt className="text-[12px] text-muted">In school</dt>
          <dd className="tnum mt-1 text-[18px] font-semibold text-ink">{percent(c.rate)}</dd>
        </div>
      </dl>

      <div className="px-5 pt-5 pb-5">
        <h3 className="mb-2 text-[12.5px] font-semibold text-ink-2">{away.length ? "Not present or late" : "Everyone is in"}</h3>
        {away.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {away.map(({ s, m }) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={s.name} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{s.name}</p>
                  {notes[s.id] ? <p className="truncate text-[12px] text-muted">“{notes[s.id]}”</p> : <p className="text-[12px] text-faint">Roll {s.roll}</p>}
                </div>
                <Badge tone={m === "A" ? "bad" : m === "L" ? "warn" : "info"} dot>
                  {m === "E" ? "On leave" : MARK_META[m!].label}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">All {roster.length} students were present and on time.</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12.5px] text-muted">
        <span>Corrections are logged with the time, and parents are told if a mark changes.</span>
        <ButtonLink href="/dashboard" variant="ghost" size="sm">
          Back to My day <ChevronRight />
        </ButtonLink>
      </div>
    </Card>
  );
}

// ——— A past day, in a side sheet ————————————————————————————————————————

function PastRegister({ classKey, label, day, onClose }: { classKey: string; label: string; day: Date | null; onClose: () => void }) {
  const groups = useMemo(() => {
    if (!day) return null;
    const list = studentsInClass(classKey).map((s) => ({ s, m: markFor(s, day) }));
    return { c: classDay(classKey, day), A: list.filter((x) => x.m === "A"), L: list.filter((x) => x.m === "L"), E: list.filter((x) => x.m === "E") };
  }, [classKey, day]);
  return (
    <Dialog
      side
      open={day !== null}
      onClose={onClose}
      title={day ? `${label} · ${fmtWeekdayLong(day)}` : ""}
      description={groups ? `${groups.c.present + groups.c.late} of ${groups.c.total} in school · ${percent(groups.c.rate)}` : undefined}
    >
      {groups && (
        <div className="flex flex-col gap-5">
          {(["A", "E", "L"] as const).map((k) => (
            <section key={k}>
              <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold text-ink-2">
                <span className={cn("size-1.5 rounded-full", MARK_META[k].dot)} />
                {k === "E" ? "On leave" : MARK_META[k].label}
                <span className="tnum font-normal text-muted">{groups[k].length}</span>
              </h3>
              {groups[k].length ? (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {groups[k].map(({ s }) => (
                    <li key={s.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <Avatar name={s.name} size={26} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{s.name}</span>
                      <span className="tnum text-[12px] text-muted">Roll {s.roll}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">None</p>
              )}
            </section>
          ))}
          <p className="text-[12.5px] text-muted">Everyone else was present and on time.</p>
        </div>
      )}
    </Dialog>
  );
}
