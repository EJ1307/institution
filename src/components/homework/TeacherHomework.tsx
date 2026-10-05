"use client";

import { ChevronRight, ClipboardList, NotebookPen, Paperclip, Send } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Segmented, Select, Tabs } from "@/components/ui/forms";
import { Dialog, useToast } from "@/components/ui/overlay";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { Avatar, Badge, Button, Card, CardFooter, cn } from "@/components/ui/primitives";
import { addDays, today } from "@/lib/data/calendar";
import { studentsInClass } from "@/lib/data/people";
import { fmtDay, fmtTime, fmtWeekday, percent, plural } from "@/lib/format";
import { PERSONAS, useTeacher } from "@/lib/session";
import { getState, setState, useAppState } from "@/lib/store";
import { SetHomeworkDialog } from "./SetHomeworkDialog";
import { CLASS_TEACHER_OF, daysUntil, dueLabel, handedInLabel, keyParts, statusFor, tally, teacherClasses, teacherHomework, type HwItem, type SubStatus, type Tally } from "./model";

type Scope = "mine" | "class";
type When = "current" | "past" | "all";

export function TeacherHomework() {
  const teacher = useTeacher();
  const name = PERSONAS.teacher.name;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const posted = useAppState((s) => s.homework);
  const nudges = useAppState((s) => s.nudges);

  const classes = useMemo(() => teacherClasses(teacher.id), [teacher.id]);
  const all = useMemo(() => teacherHomework(teacher.id, name), [teacher.id, name, posted]); // eslint-disable-line react-hooks/exhaustive-deps
  const tallies = useMemo(() => new Map(all.map((h) => [h.id, tally(h)])), [all]);

  const [scope, setScope] = useState<Scope>("mine");
  const [cls, setCls] = useState("all");
  const [subject, setSubject] = useState("all");
  const [when, setWhen] = useState<When>("current");
  const [openId, setOpenId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  const newOpen = params.get("new") === "1";
  const setNew = (o: boolean) => router.replace(o ? `${pathname}?new=1` : pathname, { scroll: false });

  const t = today();
  const weekEnd = addDays(t, 7 - (t.getDay() === 0 ? 7 : t.getDay()));
  const mine = all.filter((h) => h.mine);
  const ownClass = all.filter((h) => h.classKey === CLASS_TEACHER_OF);
  const subjects = [...new Set(ownClass.map((h) => h.subject))].sort();

  const base = scope === "mine" ? mine : ownClass;
  const shown = base.filter((h) => {
    if (scope === "mine" && cls !== "all" && h.classKey !== cls) return false;
    if (scope === "class" && subject !== "all" && h.subject !== subject) return false;
    const left = daysUntil(h.dueOn);
    if (when === "current" && left < 0) return false;
    if (when === "past" && left >= 0) return false;
    return true;
  });

  // ——— stats ———
  const stats = useMemo(() => {
    const dueWeek = mine.filter((h) => h.dueOn >= t && h.dueOn <= weekEnd);
    const closed = mine.filter((h) => daysUntil(h.dueOn) < 0);
    const ct = closed.map((h) => tallies.get(h.id)!);
    const onTime = ct.reduce((a, x) => a + x.submitted, 0) / (ct.reduce((a, x) => a + x.total, 0) || 1);
    // students missing two or more pieces of closed work, across all sections
    const missing = new Map<string, number>();
    for (const h of closed) for (const s of studentsInClass(h.classKey)) if (statusFor(h, s).status === "pending") missing.set(s.id, (missing.get(s.id) ?? 0) + 1);
    const repeat = [...missing.values()].filter((n) => n >= 2).length;
    const missingTotal = [...missing.values()].reduce((a, b) => a + b, 0);
    const classWeek = ownClass.filter((h) => h.dueOn >= t && h.dueOn <= weekEnd);
    const next = [...dueWeek].sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime())[0];
    return { dueWeek, next, onTime, missingTotal, repeat, classWeek, classSubjects: new Set(classWeek.map((h) => h.subject)).size };
  }, [mine, ownClass, tallies, t.getTime(), weekEnd.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = all.find((h) => h.id === openId) ?? null;

  useEffect(() => {
    if (!fresh) return;
    const id = setTimeout(() => setFresh(null), 3000);
    return () => clearTimeout(id);
  }, [fresh]);

  return (
    <>
      <PageHeader
        title="Homework"
        description={`What you've set for ${classes.map((k) => keyParts(k).label).join(", ")}, and who has handed it in.`}
        actions={
          <Button variant="primary" onClick={() => setNew(true)}>
            <NotebookPen /> Set homework
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat
          label="Due this week"
          value={stats.dueWeek.length}
          sub={stats.dueWeek.length ? `next: ${keyParts(stats.next!.classKey).label}, ${dueLabel(stats.next!.dueOn).toLowerCase()}` : "Nothing due"}
        />
        <Stat label="Handed in on time" value={percent(stats.onTime)} sub="closed work, last two weeks" />
        <Stat label="Missing work" value={stats.missingTotal} sub={`${plural(stats.repeat, "student")} with two or more`} />
        <Stat label={`${keyParts(CLASS_TEACHER_OF).label} load this week`} value={stats.classWeek.length} sub={`assignments across ${plural(stats.classSubjects, "subject")}`} />
      </div>

      <Card className="min-w-0">
        <div className="px-5 pt-1">
          <Tabs
            value={scope}
            onChange={(v) => {
              setScope(v);
              setCls("all");
              setSubject("all");
            }}
            tabs={[
              { value: "mine", label: "Set by me", count: mine.length },
              { value: "class", label: `${keyParts(CLASS_TEACHER_OF).label}, all subjects`, count: ownClass.length },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2 border-b border-line px-5 py-3 md:flex-row md:items-center md:justify-between">
          {scope === "mine" ? (
            <Segmented
              value={cls}
              onChange={setCls}
              label="Class"
              className="scroll-thin max-w-full overflow-x-auto"
              options={[{ value: "all", label: "All classes" }, ...classes.map((k) => ({ value: k, label: keyParts(k).label, count: mine.filter((h) => h.classKey === k && daysUntil(h.dueOn) >= 0).length }))]}
            />
          ) : (
            <Select aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full md:w-[220px]">
              <option value="all">All subjects</option>
              {subjects.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
          <Segmented
            value={when}
            onChange={setWhen}
            label="Due"
            options={[
              { value: "current", label: "Open" },
              { value: "past", label: "Closed" },
              { value: "all", label: "All" },
            ]}
          />
        </div>

        {shown.length > 0 && (
          <div className="hidden grid-cols-[minmax(0,1fr)_110px_150px_210px_16px] gap-x-6 bg-surface-2 px-5 py-2 text-[11.5px] font-semibold text-muted lg:grid">
            <span>Homework</span>
            <span>Set on</span>
            <span>Due</span>
            <span>Handed in</span>
            <span />
          </div>
        )}

        {shown.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title={
              when === "current"
                ? scope === "mine"
                  ? `Nothing open${cls !== "all" ? ` for ${keyParts(cls).label}` : ""}`
                  : `No open homework for ${keyParts(CLASS_TEACHER_OF).label}${subject !== "all" ? ` in ${subject}` : ""}`
                : "Nothing here yet"
            }
            body={scope === "mine" ? "Homework you set appears here with live hand-in counts from the class." : "When subject teachers set homework for your class, you'll see it here, so the load stays fair."}
            action={
              scope === "mine" ? (
                <Button size="sm" variant="primary" onClick={() => setNew(true)}>
                  <NotebookPen /> Set homework{cls !== "all" ? ` for ${keyParts(cls).label}` : ""}
                </Button>
              ) : (
                <Button size="sm" onClick={() => setWhen("all")}>
                  Show closed homework
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-line border-t border-line lg:border-t-0">
            {shown.map((h) => (
              <Row key={h.id} h={h} tl={tallies.get(h.id)!} flash={fresh === h.id} showBy={scope === "class"} onOpen={() => setOpenId(h.id)} />
            ))}
          </ul>
        )}
        <CardFooter>
          <span>
            {plural(shown.length, "assignment")} · last two weeks
          </span>
          <span className="hidden sm:inline">Hand-ins sync from the class register at 4:00 pm</span>
        </CardFooter>
      </Card>

      <HomeworkSheet h={open} tl={open ? tallies.get(open.id)! : null} nudgedAt={open ? nudges[`hw:${open.id}`] : undefined} onClose={() => setOpenId(null)} />
      <SetHomeworkDialog
        open={newOpen}
        onClose={() => setNew(false)}
        classes={classes}
        subject="Mathematics"
        teacherName={name}
        onSaved={(hw) => {
          setScope("mine");
          setCls("all");
          setWhen("current");
          setFresh(hw.id);
        }}
      />
    </>
  );
}

function Row({ h, tl, flash, showBy, onOpen }: { h: HwItem; tl: Tally; flash: boolean; showBy: boolean; onOpen: () => void }) {
  const left = daysUntil(h.dueOn);
  const done = tl.submitted + tl.late;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "grid w-full grid-cols-1 gap-x-6 gap-y-2.5 px-5 py-3.5 text-left transition-colors hover:bg-surface-2 lg:grid-cols-[minmax(0,1fr)_110px_150px_210px_16px] lg:items-center",
          flash && "bg-brand-soft/50",
        )}
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13.5px] leading-snug font-semibold text-ink">{h.title}</span>
            {h.posted && <Badge tone="good" dot>New</Badge>}
            {h.attachment && <Paperclip className="size-3.5 text-muted" aria-label="Has attachment" />}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-muted">
            {keyParts(h.classKey).label} · {h.subject}
            {showBy ? ` · ${h.by}` : ""}
          </span>
        </span>
        <span className="hidden text-[12.5px] text-ink-2 lg:block">{fmtWeekday(h.assignedOn)}</span>
        <span className={cn("text-[12.5px]", left === 0 ? "font-medium text-warn" : left < 0 ? "text-muted" : "text-ink-2")}>
          <span className="text-muted lg:hidden">Set {fmtDay(h.assignedOn)} · </span>
          {left < 0 ? `Closed ${fmtDay(h.dueOn)}` : dueLabel(h.dueOn)}
        </span>
        <span className="flex items-center gap-3">
          <SubBar tl={tl} className="flex-1" />
          <span className="tnum shrink-0 text-[12px] text-ink-2">
            <span className="font-semibold text-ink">{done}</span>/{tl.total}
            {tl.late > 0 && <span className="text-muted"> · {tl.late} late</span>}
          </span>
        </span>
        <ChevronRight className="hidden size-4 text-faint lg:block" aria-hidden />
      </button>
    </li>
  );
}

/** Submitted, late and pending as one bar. */
function SubBar({ tl, className }: { tl: Tally; className?: string }) {
  const w = (n: number) => `${(n / (tl.total || 1)) * 100}%`;
  return (
    <div className={cn("flex h-1.5 overflow-hidden rounded-full bg-line", className)} role="img" aria-label={`${tl.submitted} on time, ${tl.late} late, ${tl.pending} not handed in`}>
      <span className="h-full bg-good" style={{ width: w(tl.submitted) }} />
      <span className="h-full bg-[#D9961F]" style={{ width: w(tl.late) }} />
    </div>
  );
}

const STATUS: Record<SubStatus, { label: string; tone: "good" | "warn" | "neutral" }> = {
  submitted: { label: "Handed in", tone: "good" },
  late: { label: "Late", tone: "warn" },
  pending: { label: "Not yet", tone: "neutral" },
};

function HomeworkSheet({ h, tl, nudgedAt, onClose }: { h: HwItem | null; tl: Tally | null; nudgedAt?: string; onClose: () => void }) {
  return (
    <Dialog open={Boolean(h)} onClose={onClose} side title={h?.title ?? ""} description={h ? `${keyParts(h.classKey).label} · ${h.subject} · ${h.by}` : undefined}>
      {h && tl && <SheetBody key={h.id} h={h} tl={tl} nudgedAt={nudgedAt} />}
    </Dialog>
  );
}

function SheetBody({ h, tl, nudgedAt }: { h: HwItem; tl: Tally; nudgedAt?: string }) {
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | SubStatus>("all");
  const rows = useMemo(() => studentsInClass(h.classKey).map((s) => ({ s, ...statusFor(h, s) })), [h]);
  const left = daysUntil(h.dueOn);
  const pending = rows.filter((r) => r.status === "pending");
  const list = rows.filter((r) => filter === "all" || r.status === filter);

  const remind = () => {
    setState({ nudges: { ...getState().nudges, [`hw:${h.id}`]: new Date().toISOString() } });
    toast({ title: `Reminder sent to ${plural(pending.length, "family", "families")}`, body: `${pending.slice(0, 3).map((r) => r.s.firstName).join(", ")}${pending.length > 3 ? ` and ${pending.length - 3} more` : ""} · app notification and SMS.` });
  };

  return (
      <div className="flex flex-col gap-5">
        <div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-[12.5px]">
            <div className="bg-surface px-3 py-2.5">
              <dt className="text-muted">Set on</dt>
              <dd className="mt-0.5 font-medium text-ink">{fmtWeekday(h.assignedOn)}</dd>
            </div>
            <div className="bg-surface px-3 py-2.5">
              <dt className="text-muted">Due</dt>
              <dd className={cn("mt-0.5 font-medium", left === 0 ? "text-warn" : "text-ink")}>
                {fmtWeekday(h.dueOn)}
                <span className="font-normal text-muted"> · {left < 0 ? "closed" : dueLabel(h.dueOn).replace("Due ", "").toLowerCase()}</span>
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[13.5px] leading-[1.65] text-ink-2">{h.detail}</p>
          {h.attachment && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12.5px] text-ink-2">
              <Paperclip className="size-3.5 text-muted" /> {h.attachment}
            </p>
          )}
        </div>

        <section>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Handed in</p>
              <p className="mt-1 text-[22px] leading-none font-semibold text-ink">
                <span className="tnum">{tl.submitted + tl.late}</span>
                <span className="text-[14px] font-medium text-muted"> of {tl.total}</span>
              </p>
            </div>
            <ul className="flex gap-3 text-[12px] text-ink-2">
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-good" /> On time <span className="tnum font-semibold">{tl.submitted}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#D9961F]" /> Late <span className="tnum font-semibold">{tl.late}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-line-strong" /> Not yet <span className="tnum font-semibold">{tl.pending}</span>
              </li>
            </ul>
          </div>
          <SubBar tl={tl} className="mt-3 h-2" />
          {pending.length > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
              <p className="text-[12.5px] text-muted">
                {nudgedAt ? `Reminded ${fmtDay(new Date(nudgedAt))}, ${fmtTime(new Date(nudgedAt))}` : left < 0 ? `${plural(pending.length, "student")} never handed it in` : `${plural(pending.length, "student")} still to hand in`}
              </p>
              <Button size="sm" variant={nudgedAt ? "secondary" : "primary"} onClick={remind}>
                <Send /> {nudgedAt ? "Remind again" : `Remind ${pending.length} pending`}
              </Button>
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="eyebrow">Students</h4>
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              label="Filter students"
              options={[
                { value: "all", label: "All" },
                { value: "pending", label: "Not yet", count: tl.pending },
                { value: "late", label: "Late", count: tl.late },
              ]}
            />
          </div>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {list.map(({ s, status, at }) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                <span className="tnum w-5 text-right text-[11.5px] text-faint">{s.roll}</span>
                <Avatar name={s.name} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{s.name}</span>
                  {at && <span className="block text-[11.5px] text-muted">{handedInLabel(at)}</span>}
                </span>
                <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-6 text-center text-[12.5px] text-muted">{filter === "late" ? "No late hand-ins." : "Everyone has handed it in."}</li>}
          </ul>
        </section>
      </div>
  );
}

