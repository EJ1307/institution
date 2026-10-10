"use client";

import { Lock } from "lucide-react";
import { useId } from "react";
import { Select, Switch } from "@/components/ui/forms";
import { useToast } from "@/components/ui/overlay";
import { Card, CardHeader, cn } from "@/components/ui/primitives";
import { number, dollars } from "@/lib/format";
import { setState, useAppState } from "@/lib/store";
import { InfoRow, SettingRow } from "./rows";

const CHANNELS = [
  { id: "sms", label: "SMS", cost: 0.01 },
  { id: "whatsapp", label: "WhatsApp", cost: 0.005 },
  { id: "email", label: "Email", cost: 0 },
  { id: "push", label: "App push", cost: 0 },
] as const;
type Channel = (typeof CHANNELS)[number]["id"];

type Event = { id: string; label: string; who: string; perMonth: number; on: Channel[]; locked?: Channel[] };

const GROUPS: { group: string; events: Event[] }[] = [
  {
    group: "Attendance",
    events: [
      { id: "absent", label: "Child marked absent", who: "Parents · by 9:45 am", perMonth: 1650, on: ["sms", "whatsapp", "push"] },
      { id: "late", label: "Late arrival at the gate", who: "Parents", perMonth: 420, on: ["push"] },
      { id: "low", label: "Attendance below 85%", who: "Parents & class teacher · monthly", perMonth: 140, on: ["whatsapp", "email", "push"] },
    ],
  },
  {
    group: "Fees",
    events: [
      { id: "invoice", label: "Fee invoice issued", who: "Parents · quarterly", perMonth: 520, on: ["whatsapp", "email", "push"] },
      { id: "reminder", label: "Reminder 3 days before due", who: "Parents with dues", perMonth: 880, on: ["sms", "whatsapp", "push"] },
      { id: "overdue", label: "Payment overdue", who: "Parents · weekly until paid", perMonth: 320, on: ["sms", "whatsapp", "email"] },
      { id: "receipt", label: "Payment receipt", who: "Parents", perMonth: 540, on: ["email", "push"], locked: ["email"] },
    ],
  },
  {
    group: "Academics",
    events: [
      { id: "results", label: "Results published", who: "Parents", perMonth: 460, on: ["whatsapp", "email", "push"] },
      { id: "homework", label: "Homework set", who: "Parents & students", perMonth: 31000, on: ["push"] },
      { id: "ptm", label: "PTM and event reminders", who: "Parents", perMonth: 2400, on: ["whatsapp", "push"] },
    ],
  },
  {
    group: "Transport",
    events: [
      { id: "bus-near", label: "Bus approaching the stop", who: "Parents on the route", perMonth: 14800, on: ["push"] },
      { id: "bus-late", label: "Bus running 10+ min late", who: "Parents on the route", perMonth: 260, on: ["sms", "push"] },
    ],
  },
  {
    group: "School",
    events: [
      { id: "notice", label: "New notice posted", who: "Audience of the notice", perMonth: 16400, on: ["email", "push"] },
      { id: "emergency", label: "Emergency or school closure", who: "Everyone · cannot be turned off", perMonth: 0, on: ["sms", "whatsapp", "email", "push"], locked: ["sms", "whatsapp", "email", "push"] },
      { id: "leave", label: "Leave approved or declined", who: "Staff", perMonth: 60, on: ["email", "push"] },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.events);

export function NotificationsSection() {
  const toast = useToast();
  const id = useId();
  const prefs = useAppState((s) => s.settings.notifications);
  const quiet = prefs?.["quiet|on"] ?? true;

  const isOn = (e: Event, c: Channel) => (e.locked?.includes(c) ? true : (prefs?.[`${e.id}|${c}`] ?? e.on.includes(c)));
  const toggle = (e: Event, c: Channel, v: boolean) => {
    setState((st) => ({ settings: { ...st.settings, notifications: { ...st.settings.notifications, [`${e.id}|${c}`]: v } } }));
    toast({ title: `${e.label}: ${CHANNELS.find((x) => x.id === c)!.label} ${v ? "on" : "off"}`, body: v ? "Applies from the next message." : "Families can still see these in the app.", tone: v ? "good" : "info" });
  };

  const volume = (c: Channel) => ALL.filter((e) => isOn(e, c)).reduce((a, e) => a + e.perMonth, 0);
  const sms = volume("sms");
  const wa = volume("whatsapp");
  const cost = sms * CHANNELS[0].cost + wa * CHANNELS[1].cost;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line shadow-[var(--shadow-card)] md:grid-cols-4">
        {CHANNELS.map((c) => (
          <div key={c.id} className="bg-surface px-4 py-3.5">
            <div className="text-[12px] font-medium text-muted">{c.label} · per month</div>
            <div className="tnum mt-1 text-[20px] leading-tight font-semibold text-ink">≈ {number(Math.round(volume(c.id) / 10) * 10)}</div>
            <div className="mt-1 text-[12px] text-muted">
              {c.id === "sms" ? `${dollars(volume("sms") * c.cost)} at $0.01 each` : c.id === "whatsapp" ? `${dollars(volume("whatsapp") * c.cost)} at $0.005 each` : c.id === "email" ? "Included in the plan" : "Free · 92% of parents use the app"}
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader
          title="What families and staff hear about"
          description={`Turn channels on or off per event. Estimated messaging cost at these settings: ${dollars(cost)} a month.`}
        />
        <MobileList isOn={isOn} toggle={toggle} />
        <div className="scroll-thin hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead className="bg-surface-2 text-[11.5px] font-semibold text-muted">
              <tr>
                <th scope="col" className="h-9 border-y border-line pr-3 pl-5 text-left">
                  Event
                </th>
                {CHANNELS.map((c) => (
                  <th key={c.id} scope="col" className="h-9 w-[92px] border-y border-line px-2 text-center last:pr-5">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => (
                <GroupRows key={g.group} group={g.group} events={g.events} isOn={isOn} toggle={toggle} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Delivery" description="Rules that apply to every message" />
        <div className="mx-5 mb-2 divide-y divide-line border-t border-line">
          <SettingRow
            label="Quiet hours"
            hint="Hold non-urgent messages from 9 pm to 7 am"
            control={
              <Switch
                checked={quiet}
                label="Quiet hours"
                onChange={(v) => {
                  setState((st) => ({ settings: { ...st.settings, notifications: { ...st.settings.notifications, "quiet|on": v } } }));
                  toast({ title: v ? "Quiet hours on" : "Quiet hours off", body: v ? "Non-urgent messages wait until 7 am. Emergencies always go through." : "Messages go out as soon as they are triggered.", tone: "info" });
                }}
              />
            }
          />
          <SettingRow
            htmlFor={`${id}-lang`}
            label="Message language"
            hint="Parents choose their language in the app"
            control={
              <Select id={`${id}-lang`} defaultValue="en-hi" onChange={() => toast({ title: "Message language updated", body: "Templates switch at the next send." })}>
                <option value="en">English only</option>
                <option value="en-hi">English + Hindi</option>
                <option value="hi">Hindi only</option>
              </Select>
            }
          />
          <dl className="divide-y divide-line">
            <InfoRow k="SMS sender ID" v={<span className="tnum">AMLTAS · DLT-registered templates</span>} />
            <InfoRow k="WhatsApp" v="Verified school business number · 24 approved templates" />
            <InfoRow k="Fallback" v="If an app push isn't opened in 15 minutes, urgent messages go by SMS" />
          </dl>
        </div>
      </Card>
    </div>
  );
}

function GroupRows({ group, events, isOn, toggle }: { group: string; events: Event[]; isOn: (e: Event, c: Channel) => boolean; toggle: (e: Event, c: Channel, v: boolean) => void }) {
  return (
    <>
      <tr>
        <td colSpan={5} className="border-b border-line px-5 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
          {group}
        </td>
      </tr>
      {events.map((e) => (
        <tr key={e.id} className="border-b border-line">
          <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-normal">
            <span className="block text-ink">{e.label}</span>
            <span className="block text-[12px] text-muted">{e.who}</span>
          </th>
          {CHANNELS.map((c) => {
            const locked = e.locked?.includes(c.id);
            return (
              <td key={c.id} className="px-2 text-center last:pr-5">
                <span className={cn("inline-flex items-center justify-center", locked && "opacity-60")}>
                  {locked ? (
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-muted" title="Always on">
                      <Lock className="size-3" /> On
                    </span>
                  ) : (
                    <Switch checked={isOn(e, c.id)} onChange={(v) => toggle(e, c.id, v)} label={`${e.label} by ${c.label}`} />
                  )}
                </span>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function MobileList({ isOn, toggle }: { isOn: (e: Event, c: Channel) => boolean; toggle: (e: Event, c: Channel, v: boolean) => void }) {
  return (
    <div className="border-t border-line sm:hidden">
      {GROUPS.map((g) => (
        <section key={g.group}>
          <h3 className="border-b border-line bg-surface-2 px-4 py-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">{g.group}</h3>
          <ul>
            {g.events.map((e) => (
              <li key={e.id} className="border-b border-line px-4 py-3 last:border-b-0">
                <p className="text-[13px] text-ink">{e.label}</p>
                <p className="text-[12px] text-muted">{e.who}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CHANNELS.map((c) => {
                    const locked = e.locked?.includes(c.id);
                    const on = isOn(e, c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        disabled={locked}
                        onClick={() => toggle(e, c.id, !on)}
                        className={cn(
                          "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium transition-colors",
                          on ? "border-brand bg-brand-soft text-brand" : "border-line-strong text-muted",
                          locked && "opacity-70",
                        )}
                      >
                        {locked && <Lock className="size-3" />}
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
