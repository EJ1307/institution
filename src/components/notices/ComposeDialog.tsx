"use client";

import { BatteryFull, Bell, CalendarClock, Mail, MessageCircle, MessageSquareText, Send, Signal, UsersRound, Wifi } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Crest } from "@/components/shell/Crest";
import { Field, Input, Segmented, Select, Switch, Textarea } from "@/components/ui/forms";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Button, cn } from "@/components/ui/primitives";
import { addDays, fromIso, isoDate, nextSchoolDay, today } from "@/lib/data/calendar";
import { fmtTime, fmtWeekday, number, rupees } from "@/lib/format";
import { setState, type PostedNotice } from "@/lib/store";
import { audienceLabel, CLASS_TARGETS, reachesStudent, recipientsFor, ROUTE_TARGETS, scopeFromKey, type AudienceKind } from "@/components/comms/audience";
import { studentById, students } from "@/lib/data/people";
import { classLabel } from "@/lib/data/school";
import { FeedCard } from "./FeedCard";
import { CATEGORIES, CHANNELS, type Channel } from "./model";

const CHANNEL_META: Record<Channel, { icon: ReactNode; label: string; note: string }> = {
  App: { icon: <Bell />, label: "App push", note: "Free" },
  SMS: { icon: <MessageSquareText />, label: "SMS", note: "₹0.20 each" },
  WhatsApp: { icon: <MessageCircle />, label: "WhatsApp", note: "₹0.13 each" },
  Email: { icon: <Mail />, label: "Email", note: "Free" },
};

type Mode = "admin" | "teacher";

export function ComposeDialog({ open, onClose, mode, classKey = "8-B", author }: { open: boolean; onClose: () => void; mode: Mode; classKey?: string; author: string }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === "teacher" ? `Message VIII-B parents` : "Compose notice"}
      description={mode === "teacher" ? "Goes to the parents of your class only. The principal's office can see it too." : "Parents see it in the app first; other channels follow within a minute."}
    >
      {open && <ComposeForm mode={mode} classKey={classKey} author={author} onDone={onClose} />}
    </Dialog>
  );
}

function ComposeForm({ mode, classKey, author, onDone }: { mode: Mode; classKey: string; author: string; onDone: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<AudienceKind>("school");
  const [schoolKey, setSchoolKey] = useState("parents");
  const [classTarget, setClassTarget] = useState("class:8-B");
  const [staffKey, setStaffKey] = useState("staff:teaching");
  const [routeKey, setRouteKey] = useState("route:R1");
  const [category, setCategory] = useState<string>("Academic");
  const [requiresAck, setRequiresAck] = useState(false);
  const [channels, setChannels] = useState<Channel[]>(["App", "WhatsApp"]);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [date, setDate] = useState(isoDate(nextSchoolDay(today())));
  const [time, setTime] = useState("07:30");
  const [tried, setTried] = useState(false);
  const [view, setView] = useState<"write" | "preview">("write");
  const [screenPick, setScreen] = useState<Screen>("app");

  const audienceKey = mode === "teacher" ? `class:${classKey}` : kind === "school" ? schoolKey : kind === "class" ? classTarget : kind === "staff" ? staffKey : routeKey;
  const recipients = recipientsFor(audienceKey);
  const label = audienceLabel(audienceKey);
  const staffOnly = audienceKey.startsWith("staff");

  const scheduledAt = useMemo(() => {
    const d = fromIso(date);
    const [h, m] = time.split(":").map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }, [date, time]);

  const errors = {
    title: !title.trim() ? "Give the notice a title" : title.length > 100 ? "Keep the title under 100 characters" : null,
    body: !body.trim() ? "Write the message parents will read" : body.trim().length < 20 ? "A little more detail, please (at least 20 characters)" : null,
    channels: channels.length === 0 ? "Pick at least one channel" : null,
    when: when === "later" && scheduledAt.getTime() <= Date.now() + 5 * 60000 ? "Pick a time at least five minutes from now" : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (tried ? errors[k] : null);

  const billed = channels.filter((c) => c === "SMS" || c === "WhatsApp");
  const cost = billed.reduce((a, c) => a + recipients.count * (c === "SMS" ? 0.2 : 0.13), 0);

  const toggleChannel = (c: Channel) => setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : CHANNELS.filter((x) => x === c || cs.includes(x))));

  const submit = () => {
    setTried(true);
    if (!valid) {
      setView("write");
      return;
    }
    const postedAt = when === "now" ? new Date() : scheduledAt;
    const notice: PostedNotice = {
      id: `NP-${Date.now().toString(36)}`,
      title: title.trim(),
      body: body.trim(),
      audience: label,
      audienceKey,
      reachTotal: recipients.count,
      category,
      author,
      postedAt: postedAt.toISOString(),
      requiresAck,
      channels,
      scheduled: when === "later" || undefined,
    };
    setState((s) => ({ notices: [notice, ...s.notices] }));
    toast(
      when === "now"
        ? { title: `Notice sent to ${number(recipients.count)} ${recipients.noun}`, body: `${channels.map((c) => CHANNEL_META[c].label).join(", ")} · ${label}` }
        : { title: "Notice scheduled", body: `Goes out ${fmtWeekday(postedAt)} at ${fmtTime(postedAt)} to ${number(recipients.count)} ${recipients.noun}.`, tone: "info" },
    );
    onDone();
  };

  const screens: Screen[] = ["app", ...(channels.includes("App") ? (["push"] as const) : []), ...(channels.includes("SMS") ? (["sms"] as const) : []), ...(channels.includes("WhatsApp") ? (["whatsapp"] as const) : [])];
  const screen = screens.includes(screenPick) ? screenPick : "app";

  const draft = { id: "draft", title: title.trim(), body: body.trim(), category, author, postedAt: when === "now" ? new Date() : scheduledAt, requiresAck };

  return (
    <div className="-mx-5 -my-4 flex flex-col">
      <div className="border-b border-line px-5 py-2.5 md:hidden">
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          label="Compose or preview"
          options={[
            { value: "write", label: "Write" },
            { value: "preview", label: "Phone preview" },
          ]}
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_288px]">
        <form
          className={cn("flex flex-col gap-4 px-5 py-4", view === "preview" && "hidden md:flex")}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <Field label="Title" htmlFor="nt-title" error={show("title")} hint={`${title.length}/100`}>
            <Input id="nt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "teacher" ? "e.g. Maths Olympiad practice on Saturday" : "e.g. School closed on Friday for Dussehra"} aria-invalid={Boolean(show("title"))} maxLength={120} />
          </Field>
          <Field label="Message" htmlFor="nt-body" error={show("body")} hint="Keep it short and specific: what, when, and what parents need to do.">
            <Textarea id="nt-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} aria-invalid={Boolean(show("body"))} placeholder="Dear parents," />
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-2">Audience</span>
            {mode === "teacher" ? (
              <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-[13px] text-ink-2">
                <UsersRound className="size-4 text-muted" /> Parents of VIII-B
                <span className="ml-auto text-[12px] text-muted">Your class</span>
              </div>
            ) : (
              <>
                <Segmented
                  value={kind}
                  onChange={setKind}
                  label="Audience type"
                  className="scroll-thin max-w-full overflow-x-auto"
                  options={[
                    { value: "school", label: "Whole school" },
                    { value: "class", label: "Class or stage" },
                    { value: "staff", label: "Staff" },
                    { value: "route", label: "Bus route" },
                  ]}
                />
                {kind === "school" && (
                  <Select aria-label="Whole school audience" value={schoolKey} onChange={(e) => setSchoolKey(e.target.value)} className="w-full">
                    <option value="parents">All parents</option>
                    <option value="school">All parents and staff</option>
                  </Select>
                )}
                {kind === "class" && (
                  <Select aria-label="Class or stage" value={classTarget} onChange={(e) => setClassTarget(e.target.value)} className="w-full">
                    <optgroup label="Stages">
                      {CLASS_TARGETS.stages.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </optgroup>
                    {CLASS_TARGETS.grades.map((g) => (
                      <optgroup key={g.key} label={g.label.replace(" — all sections", "")}>
                        <option value={g.key}>{g.label}</option>
                        {g.sections.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                )}
                {kind === "staff" && (
                  <Select aria-label="Staff audience" value={staffKey} onChange={(e) => setStaffKey(e.target.value)} className="w-full">
                    <option value="staff:teaching">Teaching staff</option>
                    <option value="staff:all">All staff, including admin and support</option>
                  </Select>
                )}
                {kind === "route" && (
                  <Select aria-label="Bus route" value={routeKey} onChange={(e) => setRouteKey(e.target.value)} className="w-full">
                    {ROUTE_TARGETS.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                )}
              </>
            )}
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              Reaches <span className="tnum font-semibold text-ink">{number(recipients.count)}</span> {recipients.noun}
            </p>
          </div>

          <Field label="Category" htmlFor="nt-cat">
            <Select id="nt-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full sm:w-[260px]">
              {(mode === "teacher" ? ["Academic", "Events", "Health & safety", "Administrative"] : CATEGORIES).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>

          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-line-strong/90 px-3.5 py-3">
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-ink">Ask {staffOnly ? "staff" : "parents"} to acknowledge</span>
              <span className="mt-0.5 block text-[12px] text-muted">
                {requiresAck ? "They get an Acknowledge button, and you can see and remind anyone who hasn't responded." : "For consent forms, fee deadlines and anything you need a record of."}
              </span>
            </span>
            <Switch checked={requiresAck} onChange={setRequiresAck} label="Requires acknowledgement" />
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[12.5px] font-medium text-ink-2">Channels</legend>
            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map((c) => {
                const on = channels.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleChannel(c)}
                    className={cn(
                      "flex h-10 items-center justify-between gap-2 rounded-lg border px-3 text-left transition-colors [&_svg]:size-4",
                      on ? "border-brand bg-brand-soft/60 text-ink" : "border-line-strong/90 text-ink-2 hover:border-line-strong hover:bg-surface-2",
                    )}
                  >
                    <span className={cn("flex items-center gap-1.5 text-[12.5px] font-medium", on ? "text-brand" : "text-muted")}>
                      {CHANNEL_META[c].icon}
                      <span className={on ? "text-ink" : "text-ink-2"}>{CHANNEL_META[c].label}</span>
                    </span>
                    <span className="text-[11.5px] whitespace-nowrap text-muted">{CHANNEL_META[c].note}</span>
                  </button>
                );
              })}
            </div>
            {show("channels") ? (
              <p className="text-[12px] text-bad">{show("channels")}</p>
            ) : (
              <p className="text-[12px] text-muted">
                {cost > 0 ? (
                  <>
                    About <span className="tnum font-medium text-ink-2">{cost >= 100 ? rupees(cost) : `₹${cost.toFixed(2)}`}</span> in SMS and WhatsApp charges.
                  </>
                ) : (
                  "No messaging charges for app push and email."
                )}
              </p>
            )}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-2">When</span>
            <Segmented
              value={when}
              onChange={setWhen}
              label="When to send"
              options={[
                { value: "now", label: "Send now" },
                { value: "later", label: "Schedule" },
              ]}
            />
            {when === "later" && (
              <div className="mt-1 grid grid-cols-2 gap-2 sm:max-w-[320px]">
                <Input type="date" aria-label="Send on date" value={date} min={isoDate(today())} max={isoDate(addDays(today(), 60))} onChange={(e) => setDate(e.target.value)} />
                <Input type="time" aria-label="Send at time" value={time} onChange={(e) => setTime(e.target.value)} step={300} />
              </div>
            )}
            {show("when") && <p className="text-[12px] text-bad">{show("when")}</p>}
            {when === "later" && !show("when") && <p className="text-[12px] text-muted">Goes out {fmtWeekday(scheduledAt)} at {fmtTime(scheduledAt)}. Morning notices before 8 am get the best read rates.</p>}
          </div>

          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>

        <aside className={cn("border-line bg-surface-2 px-5 py-5 md:border-l", view === "write" && "hidden md:block")} aria-label="Preview on a parent's phone">
          <div className="md:sticky md:top-0">
          <p className="eyebrow mb-3 text-center">{staffOnly ? "On a teacher's phone" : "On a parent's phone"}</p>
          <div className="mb-4 flex justify-center">
            <Segmented size="sm" value={screen} onChange={setScreen} label="Preview screen" options={screens.map((x) => ({ value: x, label: SCREEN_LABEL[x] }))} />
          </div>
          <PhonePreview draft={draft} screen={screen} who={previewWho(audienceKey)} />
          </div>
        </aside>
      </div>

      <footer className="sticky -bottom-4 flex flex-col gap-2 border-t border-line bg-surface-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-muted">
          {label} · <span className="tnum">{number(recipients.count)}</span> {recipients.noun}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} className="flex-1 sm:flex-none">
            {when === "now" ? (
              <>
                <Send /> Send notice
              </>
            ) : (
              <>
                <CalendarClock /> Schedule
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}

type Screen = "app" | "push" | "sms" | "whatsapp";
const SCREEN_LABEL: Record<Screen, string> = { app: "App", push: "Push", sms: "SMS", whatsapp: "WhatsApp" };

type Draft = { id: string; title: string; body: string; category: string; author: string; postedAt: Date; requiresAck: boolean };

/** Whose phone the preview pretends to be: a real family in the audience. */
function previewWho(key: string) {
  const scope = scopeFromKey(key);
  if (!scope.parents) return "Staff";
  const aanya = studentById("S-AANYA");
  const s = aanya && reachesStudent(scope, aanya) ? aanya : students().find((x) => reachesStudent(scope, x));
  return s ? `${s.firstName} · ${classLabel(s.grade, s.section)}` : "";
}

function PhonePreview({ draft, screen, who }: { draft: Draft; screen: Screen; who: string }) {
  const now = new Date();
  const clock = fmtTime(now).replace(/\s?[ap]m/, "");
  const title = draft.title || "Your notice title";
  const body = draft.body || "The first lines of your message show here.";
  const dark = screen === "push";
  return (
    <div className="mx-auto w-[236px] rounded-[34px] border-[7px] border-[#1d1f22] bg-[#1d1f22] shadow-[0_18px_40px_-18px_rgb(0_0_0/0.45)]">
      <div className={cn("relative flex h-[452px] flex-col overflow-hidden rounded-[27px]", dark ? "bg-brand-deep text-white" : screen === "whatsapp" ? "bg-[#efeae2]" : "bg-paper")}>
        <div className={cn("relative flex h-7 shrink-0 items-center justify-between px-5 text-[10.5px] font-semibold", dark ? "text-white" : "text-ink")}>
          <span className="tnum">{dark ? "" : clock}</span>
          <span className="absolute top-1.5 left-1/2 h-[18px] w-[74px] -translate-x-1/2 rounded-full bg-[#1d1f22]" aria-hidden />
          <span className="flex items-center gap-1 [&_svg]:size-3">
            <Signal />
            <Wifi />
            <BatteryFull />
          </span>
        </div>

        {screen === "app" && (
          <>
            <div className="flex items-center gap-2 border-b border-line bg-surface px-3.5 py-2.5">
              <Crest size={20} />
              <span className="text-[12.5px] font-semibold text-ink">Notices</span>
              <span className="ml-auto text-[10px] text-muted">{who}</span>
            </div>
            <div className="flex flex-col gap-2 p-2.5">
              <FeedCard n={draft} now={now} unread compact />
              <div className="rounded-[14px] border border-line bg-surface px-3 py-2.5 opacity-60" aria-hidden>
                <div className="h-2 w-16 rounded-full bg-line" />
                <div className="mt-2 h-2.5 w-40 rounded-full bg-line" />
                <div className="mt-1.5 h-2 w-36 rounded-full bg-line/70" />
              </div>
            </div>
          </>
        )}

        {screen === "push" && (
          <div className="flex flex-1 flex-col items-center px-2.5">
            <p className="mt-6 text-[11px] text-white/70">{fmtWeekday(now)}</p>
            <p className="tnum text-[46px] leading-none font-semibold tracking-tight">{clock}</p>
            <div className="mt-6 w-full rounded-2xl bg-white/90 px-3 py-2.5 text-ink shadow-[0_8px_24px_-8px_rgb(0_0_0/0.35)]">
              <div className="flex items-center gap-1.5 text-[9.5px] text-muted">
                <Crest size={13} />
                <span className="font-semibold tracking-wide uppercase">Amaltas</span>
                <span className="ml-auto">now</span>
              </div>
              <p className="mt-1 truncate text-[11.5px] font-semibold">{title}</p>
              <p className="line-clamp-3 text-[10.5px] leading-[14px] text-ink-2">{body}</p>
            </div>
          </div>
        )}

        {screen === "sms" && (
          <>
            <div className="flex flex-col items-center border-b border-line bg-surface pt-1 pb-2">
              <span className="grid size-8 place-items-center rounded-full bg-ink/10 text-[10px] font-semibold text-ink-2">AX</span>
              <span className="mt-1 text-[10.5px] font-medium text-ink">AX-AMLTAS</span>
            </div>
            <div className="flex flex-col gap-1 p-3">
              <p className="text-center text-[9.5px] text-faint">Today {fmtTime(now)}</p>
              <p className="max-w-[88%] rounded-2xl rounded-bl-md bg-ink/[0.07] px-3 py-2 text-[11px] leading-snug text-ink">
                Amaltas Intl School: {title}. Read more: kaksha.in/n/4K2P
              </p>
              <p className="mt-1 text-[9.5px] text-faint">SMS carries the title and a link, in one 160-character message.</p>
            </div>
          </>
        )}

        {screen === "whatsapp" && (
          <>
            <div className="flex items-center gap-2 bg-[#f6f5f1] px-3 py-2">
              <Crest size={22} />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-ink">Amaltas International School</p>
                <p className="text-[9px] text-muted">Business account</p>
              </div>
            </div>
            <div className="p-3">
              <div className="max-w-[92%] rounded-xl rounded-tl-sm bg-white px-2.5 py-2 text-[11px] leading-snug text-ink shadow-[0_1px_0_rgb(0_0_0/0.06)]">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 line-clamp-6 whitespace-pre-line text-ink-2">{body}</p>
                <p className="mt-1 text-right text-[9px] text-faint">{fmtTime(now)}</p>
                {draft.requiresAck && <p className="-mx-2.5 mt-1.5 border-t border-line pt-1.5 text-center text-[11px] font-medium text-[#1f7aa8]">Acknowledge</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
