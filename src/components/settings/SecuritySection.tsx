"use client";

import { Archive, Download, Globe2, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useId, useMemo } from "react";
import { Select, Switch } from "@/components/ui/forms";
import { KeyValue } from "@/components/ui/layout";
import { useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { downloadCsv } from "@/components/students/shared";
import { leaveRequests } from "@/lib/data/attendance";
import { applications } from "@/lib/data/admissions";
import { addDays, isoDate, today } from "@/lib/data/calendar";
import { studentById, students } from "@/lib/data/people";
import { classLabel } from "@/lib/data/school";
import { fmtDay, number } from "@/lib/format";
import { setState, useAppState } from "@/lib/store";

type Entry = { when: string; sort: number; who: string; action: string; detail: string; device: string };

export function SecuritySection() {
  const toast = useToast();
  const id = useId();
  const settings = useAppState((s) => s.settings);
  const decisions = useAppState((s) => s.leaveDecisions);
  const stages = useAppState((s) => s.admissionStages);
  const payments = useAppState((s) => s.payments);
  const attendance = useAppState((s) => s.attendance);
  const twoFactor = settings.twoFactor ?? true;
  const timeout = settings.sessionTimeout ?? "30";
  const t = today();
  const families = new Set(students().map((s) => s.parentId)).size;

  const log = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    // actions taken in this demo come first
    const leaves = leaveRequests();
    for (const [lid, d] of Object.entries(decisions)) {
      const l = leaves.find((x) => x.id === lid);
      if (l) out.push({ when: "Today", sort: 3e12, who: "Dr. Meenakshi Rao", action: d === "approved" ? "Approved leave" : "Declined leave", detail: `${l.staff.title} ${l.staff.name} · ${l.type}, ${fmtDay(l.from)}`, device: "Chrome · Windows" });
    }
    const apps = applications();
    for (const [aid, st] of Object.entries(stages)) {
      const a = apps.find((x) => x.id === aid);
      if (a) out.push({ when: "Today", sort: 3e12, who: "Dr. Meenakshi Rao", action: "Moved application", detail: `${a.child} → ${st}`, device: "Chrome · Windows" });
    }
    for (const [key, p] of Object.entries(payments)) {
      const s = studentById(key.split("|")[0]);
      if (s) out.push({ when: "Today", sort: 3e12, who: s.guardians[0].name, action: "Paid fees online", detail: `${s.name} · ${key.split("|")[1]} · ${p.receipt}`, device: "Parent app · Android" });
    }
    for (const key of Object.keys(attendance)) {
      const [cls, date] = key.split("|");
      const [g, sec] = cls.split("-");
      out.push({ when: date === isoDate(t) ? "Today" : date, sort: 3e12, who: cls === "8-B" ? "Ms. Kavya Iyer" : "Class teacher", action: "Submitted register", detail: `${classLabel(g as never, sec)} · ${date}`, device: "Staff app · iPhone" });
    }
    // listed newest first
    const at = (daysAgo: number, time: string, i: number) => ({ when: daysAgo === 0 ? `Today, ${time}` : daysAgo === 1 ? `Yesterday, ${time}` : `${fmtDay(addDays(t, -daysAgo))}, ${time}`, sort: 2e12 - i });
    const seed: (Omit<Entry, "when" | "sort"> & { d: number; t: string })[] = [
      { d: 0, t: "8:42 am", who: "Ms. Kavya Iyer", action: "Signed in", detail: "Two-step verification passed", device: "Staff app · iPhone" },
      { d: 0, t: "8:15 am", who: "Mr. Joseph Sethi", action: "Exported report", detail: "Fee collection, Sept 2026 (CSV)", device: "Chrome · Windows" },
      { d: 0, t: "7:58 am", who: "Dr. Meenakshi Rao", action: "Signed in", detail: "New device — principal alerted", device: "Safari · macOS" },
      { d: 1, t: "11:15 am", who: "Mr. Arvind Khanna", action: "Posted notice", detail: "Parent–teacher meeting, Classes VI–X", device: "Chrome · Windows" },
      { d: 2, t: "5:48 pm", who: "System", action: "Failed sign-in blocked", detail: "5 wrong passwords for a staff account — locked for 15 min", device: "IP 49.36.x.x · Delhi" },
      { d: 4, t: "3:22 pm", who: "Mr. Alok Desai", action: "Published results", detail: "Half-Yearly Examination · Classes IX–XII", device: "Chrome · Windows" },
      { d: 4, t: "2:10 pm", who: "Mrs. Seema D'Souza", action: "Edited student record", detail: "Updated guardian phone · Class III-B", device: "Chrome · Windows" },
      { d: 4, t: "11:05 am", who: "Dr. Meenakshi Rao", action: "Approved concession", detail: "Sibling, 10% · Class II-C", device: "Chrome · Windows" },
      { d: 5, t: "10:40 am", who: "Dr. Meenakshi Rao", action: "Changed role", detail: "Ms. Nazia Trivedi → Class teacher, VII-A", device: "Chrome · Windows" },
    ];
    seed.forEach((e, i) => out.push({ ...at(e.d, e.t, i), who: e.who, action: e.action, detail: e.detail, device: e.device }));
    return out.sort((a, b) => b.sort - a.sort);
  }, [decisions, stages, payments, attendance, t]);

  const set = (patch: Partial<typeof settings>, title: string, body: string) => {
    setState((st) => ({ settings: { ...st.settings, ...patch } }));
    toast({ title, body, tone: "info" });
  };

  const exportLog = () => {
    downloadCsv(`audit-log-${isoDate(new Date())}.csv`, ["When", "User", "Action", "Details", "Device"], log.map((e) => [e.when, e.who, e.action, e.detail, e.device]));
    toast({ title: "Audit log exported", body: `${log.length} entries. The full 7-year history is available on request.` });
  };

  const facts = [
    { icon: Globe2, title: "Stored in India", body: "All data, backups included, stays in data centres in two Indian regions. Nothing is processed abroad." },
    { icon: LockKeyhole, title: "Encrypted everywhere", body: "AES-256 at rest and TLS 1.3 in transit. Documents are watermarked when viewed." },
    { icon: Archive, title: "Backed up daily", body: `Last backup today at 2:04 am · 35 daily restore points · tested monthly.` },
    { icon: ShieldCheck, title: "DPDP Act, 2023", body: `Verifiable parental consent on record for ${number(families)} families. Deletion requests closed within 30 days.` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {facts.map((f) => (
          <Card key={f.title} className="flex gap-3.5 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand [&_svg]:size-[18px]">
              <f.icon strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-ink">{f.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{f.body}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Sign-in & sessions" icon={<KeyRound />} />
        <dl className="mx-5 mb-4 divide-y divide-line border-t border-line">
          <KeyValue
            className="items-center"
            k={
              <span>
                Two-step verification for staff
                <span className="block text-[12px] text-faint">A code from an authenticator app or SMS on every new device</span>
              </span>
            }
            v={
              <Switch
                checked={twoFactor}
                label="Two-step verification for staff"
                onChange={(v) =>
                  set(
                    { twoFactor: v },
                    v ? "Two-step verification required" : "Two-step verification optional",
                    v ? "Staff without it set up will be asked at their next sign-in." : "Not recommended — staff accounts can see student records.",
                  )
                }
              />
            }
          />
          <KeyValue
            className="items-center"
            k={
              <label htmlFor={`${id}-timeout`}>
                Sign staff out after inactivity
                <span className="block text-[12px] text-faint">Shared computers in the staff room and office</span>
              </label>
            }
            v={
              <Select id={`${id}-timeout`} value={timeout} onChange={(e) => set({ sessionTimeout: e.target.value }, "Session timeout updated", `Staff are signed out after ${e.target.value === "480" ? "8 hours" : `${e.target.value} minutes`} without activity.`)}>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="480">8 hours</option>
              </Select>
            }
          />
          <KeyValue k="Parents" v="Mobile number + one-time code · no passwords to forget" />
          <KeyValue k="Last security review" v={`${fmtDay(new Date(t.getFullYear(), 6, 18))} · independent penetration test, no critical findings`} />
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Audit log"
          description="Every sign-in, export and change to records — kept for seven years, read-only."
          action={
            <Button size="sm" variant="secondary" onClick={exportLog}>
              <Download /> Export
            </Button>
          }
        />
        <Table>
          <THead>
            <tr>
              <Th>When</Th>
              <Th>User</Th>
              <Th>Action</Th>
              <Th className="hidden lg:table-cell">Device</Th>
            </tr>
          </THead>
          <tbody>
            {log.slice(0, 14).map((e, i) => (
              <Tr key={i}>
                <Td className="tnum whitespace-nowrap text-ink-2">
                  {e.when}
                  {e.sort === 3e12 && (
                    <Badge tone="brand" className="ml-2 h-[18px] px-1.5 text-[10.5px]">
                      New
                    </Badge>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center gap-2.5">
                    {e.who === "System" ? <span className="grid size-6 place-items-center rounded-full bg-bad-soft text-bad"><ShieldCheck className="size-3.5" /></span> : <Avatar name={e.who} size={24} />}
                    <span className="whitespace-nowrap text-ink">{e.who}</span>
                  </div>
                </Td>
                <Td>
                  <span className="block text-ink">{e.action}</span>
                  <span className="block max-w-[340px] truncate text-[12px] text-muted">{e.detail}</span>
                </Td>
                <Td className="hidden whitespace-nowrap text-muted lg:table-cell">{e.device}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
