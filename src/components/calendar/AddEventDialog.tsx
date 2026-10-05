"use client";

import { CalendarPlus } from "lucide-react";
import { useState } from "react";
import { Checkbox, Field, Input, Select, Switch } from "@/components/ui/forms";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Button } from "@/components/ui/primitives";
import { academicYear, fromIso, isoDate, isSchoolDay, holidayName } from "@/lib/data/calendar";
import { GRADES } from "@/lib/data/school";
import { fmtClock, fmtWeekday, fmtWeekdayLong } from "@/lib/format";
import { getState, setState, type PostedEvent, type PostedNotice } from "@/lib/store";
import { scopeFromLabel } from "@/components/comms/audience";
import { recipientsFor } from "@/components/comms/audience";
import { KIND_ORDER, KIND_STYLE, type Kind } from "./model";

const AUDIENCES: { label: string; key: string }[] = [
  { label: "Whole school", key: "school" },
  { label: "Parents", key: "parents" },
  { label: "Teaching staff", key: "staff:teaching" },
  { label: "Pre-primary & Primary", key: "stage:Primary" },
  { label: "Classes VI–VIII", key: "stage:Middle" },
  { label: "Classes IX–X", key: "stage:Secondary" },
  { label: "Classes XI–XII", key: "stage:Senior secondary" },
  ...GRADES.filter((g) => !Number.isNaN(Number(g.id))).map((g) => ({ label: g.label, key: `grade:${g.id}` })),
];

export function AddEventDialog({ open, initialDate, onClose, onAdded }: { open: boolean; initialDate?: string; onClose: () => void; onAdded: (e: PostedEvent) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Add to the school calendar" description="Everyone the event is for sees it on their calendar straight away." size="md">
      {open && <AddEventForm initialDate={initialDate} onDone={onClose} onAdded={onAdded} />}
    </Dialog>
  );
}

function AddEventForm({ initialDate, onDone, onAdded }: { initialDate?: string; onDone: () => void; onAdded: (e: PostedEvent) => void }) {
  const toast = useToast();
  const ay = academicYear();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("Academic");
  const [date, setDate] = useState(initialDate ?? "");
  const [multi, setMulti] = useState(false);
  const [end, setEnd] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState("09:00");
  const [place, setPlace] = useState("");
  const [audience, setAudience] = useState("Whole school");
  const [notify, setNotify] = useState(true);
  const [tried, setTried] = useState(false);

  const errors = {
    title: !title.trim() ? "What's the event called?" : null,
    date: !date ? "Pick a date" : fromIso(date) < ay.start ? `Pick a date in AY ${ay.label}` : null,
    end: multi && (!end ? "Pick the last day" : date && end < date ? "The last day can't be before the first" : null),
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (tried ? errors[k] || null : null);
  const aud = AUDIENCES.find((a) => a.label === audience)!;
  const staffOnly = !scopeFromLabel(audience).parents;
  const closedDay = date && !isSchoolDay(fromIso(date)) && kind !== "Holiday" ? holidayName(fromIso(date)) ?? (fromIso(date).getDay() === 0 ? "a Sunday" : fromIso(date).getDay() === 6 ? "a Saturday" : null) : null;

  const submit = () => {
    setTried(true);
    if (!valid) return;
    const ev: PostedEvent = {
      id: `EV-${Date.now().toString(36)}`,
      title: title.trim(),
      date,
      end: multi && end && end !== date ? end : undefined,
      time: allDay || multi ? undefined : fmtClock(time),
      place: place.trim() || undefined,
      kind,
      audience,
      createdAt: new Date().toISOString(),
    };
    const patch: { events: PostedEvent[]; notices?: PostedNotice[] } = { events: [...getState().events, ev] };
    if (notify) {
      const d = fromIso(date);
      const when = ev.end ? `from ${fmtWeekday(d)} to ${fmtWeekday(fromIso(ev.end))}` : `on ${fmtWeekdayLong(d)}${ev.time ? ` at ${ev.time}` : ""}`;
      patch.notices = [
        {
          id: `NP-${Date.now().toString(36)}`,
          title: ev.title,
          body: `${ev.title} will be held ${when}${ev.place ? `, ${ev.place}` : ""}. It has been added to the school calendar in the app.`,
          audience: aud.key === "school" ? "All parents & staff" : aud.key === "parents" ? "All parents" : staffOnly ? "Teaching staff" : `Parents · ${audience}`,
          audienceKey: aud.key,
          reachTotal: recipientsFor(aud.key).count,
          category: kind === "Holiday" || kind === "Meeting" ? "Administrative" : kind === "Academic" ? "Academic" : "Events",
          author: "Dr. Meenakshi Rao, Principal",
          postedAt: new Date().toISOString(),
          requiresAck: false,
          channels: ["App", "WhatsApp"],
        },
        ...getState().notices,
      ];
    }
    setState(patch);
    toast({ title: "Added to the calendar", body: notify ? `${audience} will also get a notice in the app.` : `${audience} can see it now.` });
    onAdded(ev);
    onDone();
  };

  return (
    <form
      className="-mx-5 -my-4 flex flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <Field label="Event" htmlFor="ev-title" error={show("title")}>
          <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Inter-school quiz, Class VIII" autoFocus />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-ink-2">Type</span>
          <div role="radiogroup" aria-label="Event type" className="flex flex-wrap gap-1.5">
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors"
                style={kind === k ? { background: KIND_STYLE[k].bg, color: KIND_STYLE[k].fg, borderColor: "transparent" } : { borderColor: "var(--line-strong)", color: "var(--ink-2)" }}
              >
                <span className="size-2 rounded-full" style={{ background: KIND_STYLE[k].dot }} />
                {k}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={multi ? "First day" : "Date"} htmlFor="ev-date" error={show("date")} hint={closedDay ? `Heads up: that's ${closedDay}` : undefined}>
            <Input id="ev-date" type="date" value={date} min={isoDate(ay.start)} max={isoDate(ay.end)} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {multi ? (
            <Field label="Last day" htmlFor="ev-end" error={show("end")}>
              <Input id="ev-end" type="date" value={end} min={date || isoDate(ay.start)} max={isoDate(ay.end)} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          ) : (
            <Field label="Starts at" htmlFor="ev-time">
              <Input id="ev-time" type="time" value={time} disabled={allDay} onChange={(e) => setTime(e.target.value)} step={900} />
            </Field>
          )}
        </div>
        <div className="-mt-1 flex flex-wrap gap-x-5 gap-y-2">
          <Checkbox checked={multi} onChange={setMulti} label="Runs over several days" />
          {!multi && <Checkbox checked={allDay} onChange={setAllDay} label="All day" />}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where" htmlFor="ev-place">
            <Input id="ev-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Auditorium, Main field…" />
          </Field>
          <Field label="Who it's for" htmlFor="ev-aud">
            <Select id="ev-aud" value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full">
              {AUDIENCES.map((a) => (
                <option key={a.key}>{a.label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-line-strong/90 px-3.5 py-3">
          <span>
            <span className="block text-[13px] font-medium text-ink">Also send a notice</span>
            <span className="mt-0.5 block text-[12px] text-muted">
              {recipientsFor(aud.key).count.toLocaleString("en-IN")} {staffOnly ? "staff" : "families"} get it in the app and on WhatsApp.
            </span>
          </span>
          <Switch checked={notify} onChange={setNotify} label="Also send a notice" />
        </label>
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          <CalendarPlus /> Add event
        </Button>
      </footer>
    </form>
  );
}
