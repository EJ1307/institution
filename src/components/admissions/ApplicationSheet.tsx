"use client";

import { ArrowRight, Check, ChevronDown, MessageCircle, Phone, RotateCcw, XCircle } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Textarea } from "@/components/ui/forms";
import { KeyValue } from "@/components/ui/layout";
import { Dialog, Menu, MenuItem, MenuLabel, MenuSeparator, useToast } from "@/components/ui/overlay";
import { Badge, Button, cn } from "@/components/ui/primitives";
import { ADMISSION_STAGES, type AdmissionStage, type Application } from "@/lib/data/admissions";
import { addDays, today } from "@/lib/data/calendar";
import { fmtDate, fmtDay, fmtWeekday, relativeDays } from "@/lib/format";
import { useSession } from "@/lib/session";
import { setState, useAppState } from "@/lib/store";
import { fmtAge } from "@/components/students/shared";
import { ageCutoff, gradeName, minAgeFor, NEXT_STEP, nextStage, stageIndex, STAGE_TONE, timelineFor } from "./model";

const EMPTY: never[] = [];

export function ApplicationSheet({ app, onClose, onMove }: { app: Application | null; onClose: () => void; onMove: (a: Application, to: AdmissionStage) => void }) {
  const toast = useToast();
  const session = useSession();
  const id = useId();
  const notesAll = useAppState((s) => s.admissionNotes);
  const notes = (app && notesAll[app.id]) || EMPTY;
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft("");
    setErr(null);
  }, [app?.id]);

  if (!app) return null;

  const t = today();
  const next = nextStage(app.stage);
  const withdrawn = app.stage === "Withdrawn";
  const idx = stageIndex(app.stage);
  const cutoff = ageCutoff();
  const ageYears = Math.floor((cutoff.getTime() - app.dob.getTime()) / (365.25 * 86400000));
  const eligible = ageYears >= minAgeFor(app.grade);
  const due = addDays(app.lastActivity, app.stage === "Offer made" ? 7 : 3);
  const timeline = timelineFor(app, notes);

  const addNote = () => {
    if (draft.trim().length < 3) return setErr("Write a short note first.");
    const n = { text: draft.trim(), at: new Date().toISOString(), by: session?.name ?? "Admissions office" };
    setState((st) => ({ admissionNotes: { ...st.admissionNotes, [app.id]: [...(st.admissionNotes[app.id] ?? []), n] } }));
    setDraft("");
    setErr(null);
    toast({ title: "Note added", body: `Visible to ${app.counsellor} and the admissions team.` });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      side
      title={app.child}
      description={`${app.id} · ${gradeName(app.grade)}, AY ${cutoff.getFullYear()}–${String(cutoff.getFullYear() + 1).slice(2)}`}
      footer={
        <>
          <Menu
            width={232}
            align="start"
            label="Move to stage"
            trigger={({ toggle, ref, open }) => (
              <Button ref={ref} variant="secondary" onClick={toggle} aria-expanded={open} className="mr-auto">
                Move to <ChevronDown />
              </Button>
            )}
          >
            {(close) => (
              <>
                <MenuLabel>Stage</MenuLabel>
                {ADMISSION_STAGES.map((s) => (
                  <MenuItem
                    key={s}
                    icon={s === app.stage ? <Check className="text-brand" /> : <span className="block size-4" />}
                    onClick={() => {
                      close();
                      if (s !== app.stage) onMove(app, s);
                    }}
                  >
                    {s}
                  </MenuItem>
                ))}
                <MenuSeparator />
                {withdrawn ? (
                  <MenuItem icon={<RotateCcw />} onClick={() => (close(), onMove(app, "Enquiry"))}>
                    Reopen as enquiry
                  </MenuItem>
                ) : (
                  <MenuItem icon={<XCircle />} tone="bad" onClick={() => (close(), onMove(app, "Withdrawn"))}>
                    Mark withdrawn
                  </MenuItem>
                )}
              </>
            )}
          </Menu>
          {next && !withdrawn && (
            <Button variant="primary" onClick={() => onMove(app, next)}>
              {next === "Enrolled" ? "Confirm enrolment" : `Move to ${next.toLowerCase()}`} <ArrowRight />
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Stage stepper */}
        <div>
          {withdrawn ? (
            <div className="flex items-center gap-2 rounded-lg bg-ink/[0.045] px-3.5 py-2.5 text-[12.5px] text-ink-2">
              <XCircle className="size-4 text-muted" /> Withdrawn on {fmtDay(app.lastActivity)}
            </div>
          ) : (
            <ol className="grid grid-cols-5 gap-1.5" aria-label="Pipeline stage">
              {ADMISSION_STAGES.map((s, i) => (
                <li key={s} className="min-w-0" aria-current={i === idx ? "step" : undefined}>
                  <div className={cn("h-1.5 rounded-full", i <= idx ? "bg-brand" : "bg-ink/[0.07]")} />
                  <div className={cn("mt-1.5 truncate text-[11px]", i === idx ? "font-semibold text-ink" : i < idx ? "text-ink-2" : "text-faint")}>{s}</div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Next step */}
        {!withdrawn && (
          <div className="rounded-lg border border-line bg-surface-2 px-4 py-3">
            <div className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">Next step</div>
            <p className="mt-0.5 text-[13.5px] font-medium text-ink">{NEXT_STEP[app.stage]}</p>
            <p className="mt-0.5 text-[12px] text-muted">
              {app.stage === "Enrolled" ? `Owner: ${app.counsellor}` : `${app.counsellor} · by ${fmtWeekday(due < t ? t : due)}`}
              {due < t && app.stage !== "Enrolled" && <span className="ml-1.5 font-medium text-warn">· follow-up overdue</span>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`tel:${app.phone.replace(/\s/g, "")}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong/80 bg-surface px-2.5 text-[12.5px] font-medium text-ink hover:bg-surface-2">
                <Phone className="size-3.5" /> Call {app.parent.split(" ")[0]}
              </a>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => toast({ title: `WhatsApp sent to ${app.parent}`, body: app.stage === "Enquiry" ? "Campus tour slots for this week, with the school's location pin." : "A short update on the next step, from the admissions number." })}
              >
                <MessageCircle /> Send WhatsApp
              </Button>
            </div>
          </div>
        )}

        <section>
          <h3 className="mb-1 text-[13px] font-semibold text-ink">Child</h3>
          <dl className="divide-y divide-line border-y border-line">
            <KeyValue k="Applying for" v={gradeName(app.grade)} />
            <KeyValue k="Date of birth" v={<span className="tnum">{fmtDate(app.dob)}</span>} />
            <KeyValue
              k={`Age on ${fmtDay(cutoff)}`}
              v={
                <span className="inline-flex items-center gap-2">
                  <span className="tnum">{fmtAge(app.dob, cutoff)}</span>
                  <Badge tone={eligible ? "good" : "bad"}>{eligible ? "Eligible" : `Needs ${minAgeFor(app.grade)}+`}</Badge>
                </span>
              }
            />
            <KeyValue k="Gender" v={app.gender === "F" ? "Girl" : "Boy"} />
            <KeyValue k="Sibling at school" v={app.sibling ? <Badge tone="brand">Yes · priority</Badge> : "No"} />
          </dl>
        </section>

        <section>
          <h3 className="mb-1 text-[13px] font-semibold text-ink">Parent</h3>
          <dl className="divide-y divide-line border-y border-line">
            <KeyValue k="Name" v={app.parent} />
            <KeyValue k="Mobile" v={<a href={`tel:${app.phone.replace(/\s/g, "")}`} className="tnum hover:underline">{app.phone}</a>} />
            <KeyValue k="Lives in" v={`${app.locality}, Gurugram`} />
          </dl>
        </section>

        <section>
          <h3 className="mb-1 text-[13px] font-semibold text-ink">Application</h3>
          <dl className="divide-y divide-line border-y border-line">
            <KeyValue k="Stage" v={<Badge tone={STAGE_TONE[app.stage]}>{app.stage}</Badge>} />
            <KeyValue k="Source" v={app.source} />
            <KeyValue k="Counsellor" v={app.counsellor} />
            <KeyValue k="First contact" v={<span className="tnum">{fmtDate(app.createdOn)}</span>} />
            <KeyValue k="Last activity" v={relativeDays(app.lastActivity, t)} />
            {app.score !== null && <KeyValue k="Interaction score" v={<span className="tnum">{app.score}/100</span>} />}
          </dl>
        </section>

        <section>
          <h3 className="mb-3 text-[13px] font-semibold text-ink">Activity</h3>
          <div className="mb-4">
            <label htmlFor={`${id}-note`} className="sr-only">
              Add a note
            </label>
            <Textarea
              id={`${id}-note`}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (err) setErr(null);
              }}
              placeholder={`Add a note for ${app.counsellor.split(" ").slice(0, 2).join(" ")}… e.g. “Parents want a Saturday visit”`}
              className="min-h-[72px]"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className={cn("text-[12px]", err ? "text-bad" : "text-muted")}>{err ?? "Notes are internal — parents never see them."}</span>
              <Button size="sm" onClick={addNote}>
                Add note
              </Button>
            </div>
          </div>
          <ol className="relative ml-1.5 border-l border-line">
            {timeline.map((e, i) => (
              <li key={i} className="relative pb-4 pl-5 last:pb-0">
                <span
                  className={cn(
                    "absolute top-1 -left-[5px] size-2.5 rounded-full ring-4 ring-surface",
                    e.kind === "milestone" ? "bg-brand" : e.kind === "note" ? "bg-accent" : e.kind === "withdrawn" ? "bg-faint" : "bg-line-strong",
                  )}
                />
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-medium text-ink">{e.title}</p>
                  <span className="tnum shrink-0 text-[11.5px] text-muted">{fmtDay(e.at)}</span>
                </div>
                {e.body && <p className={cn("mt-0.5 text-[12.5px]", e.kind === "note" ? "text-ink-2" : "text-muted")}>{e.body}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Dialog>
  );
}
