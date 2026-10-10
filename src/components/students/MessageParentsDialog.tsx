"use client";

import { useEffect, useId, useState } from "react";
import { Checkbox, Field, Segmented, Select, Textarea } from "@/components/ui/forms";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Button } from "@/components/ui/primitives";
import { currentSchoolDay, markFor } from "@/lib/data/attendance";
import { schoolDaysBack } from "@/lib/data/calendar";
import { feeAccount } from "@/lib/data/fees";
import type { Student } from "@/lib/data/people";
import { classLabel } from "@/lib/data/school";
import { fmtDay, dollars } from "@/lib/format";
import { useBrand, useSession } from "@/lib/session";

type Channel = "app" | "whatsapp" | "email";
type Template = "general" | "absence" | "fees" | "meeting";

export function MessageParentsDialog({ student: s, open, onClose, canFees }: { student: Student; open: boolean; onClose: () => void; canFees: boolean }) {
  const toast = useToast();
  const session = useSession();
  const brand = useBrand();
  const id = useId();
  const [to, setTo] = useState<Record<string, boolean>>({});
  const [channel, setChannel] = useState<Channel>("app");
  const [template, setTemplate] = useState<Template>("general");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const signer = session?.name ?? "Class teacher";

  const textFor = (t: Template) => {
    const first = s.firstName;
    const day = currentSchoolDay();
    switch (t) {
      case "absence": {
        const last = [...schoolDaysBack(40, day)].reverse().find((d) => markFor(s, d) === "A") ?? day;
        return `Dear Parent, ${first} was absent on ${fmtDay(last)} and we have no reason on record. If this was planned, please apply for leave in the app so the register can be updated. — ${signer}, ${brand.short}`;
      }
      case "fees": {
        const acc = feeAccount(s);
        return acc.nextDue
          ? `Dear Parent, ${acc.nextDue.label} fees of ${dollars(acc.nextDue.amount)} for ${first} (${classLabel(s.grade, s.section)}) are due on ${fmtDay(acc.nextDue.due)}. You can pay by UPI, card or net banking in the app. — Accounts, ${brand.short}`
          : `Dear Parent, thank you — ${first}'s fees for this year are paid up to date. — Accounts, ${brand.short}`;
      }
      case "meeting":
        return `Dear Parent, I would like to meet you briefly about ${first}'s progress. Could you visit school on any weekday between 1:30 and 2:30 pm this week? Please reply with a convenient day. — ${signer}`;
      default:
        return `Dear Parent, `;
    }
  };

  useEffect(() => {
    if (!open) return;
    setTo(Object.fromEntries(s.guardians.map((g, i) => [g.name, i === 0])));
    setChannel("app");
    setTemplate("general");
    setBody(textFor("general"));
    setError(null);
    setSending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, s.id]);

  const recipients = s.guardians.filter((g) => to[g.name]);
  const smsParts = Math.max(1, Math.ceil(body.length / 153));

  const send = () => {
    if (!recipients.length) return setError("Choose at least one parent.");
    if (body.trim().length < 12 || body.trim() === "Dear Parent,") return setError("Write a message before sending.");
    setError(null);
    setSending(true);
    setTimeout(() => {
      const names = recipients.map((r) => r.name.split(" ")[0]).join(" and ");
      const via = channel === "app" ? "the parent app, with an SMS fallback" : channel === "whatsapp" ? "WhatsApp" : "email";
      toast({ title: `Message sent to ${names}`, body: `Delivered via ${via}. Replies will appear in your inbox.` });
      onClose();
    }, 600);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Message ${s.firstName}'s parents`}
      description={`${classLabel(s.grade, s.section)} · Roll ${s.roll}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={send} loading={sending}>
            Send message
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-[12.5px] font-medium text-ink-2">To</legend>
          <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
            {s.guardians.map((g) => (
              <div key={g.name} className="flex items-center justify-between gap-3">
                <Checkbox checked={!!to[g.name]} onChange={(v) => setTo((x) => ({ ...x, [g.name]: v }))} label={`${g.name} (${g.relation.toLowerCase()})`} />
                <span className="tnum text-[12px] text-muted">{g.phone}</span>
              </div>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Send via">
            <Segmented
              label="Channel"
              size="sm"
              value={channel}
              onChange={setChannel}
              options={[
                { value: "app", label: "App + SMS" },
                { value: "whatsapp", label: "WhatsApp" },
                { value: "email", label: "Email" },
              ]}
              className="self-start"
            />
          </Field>
          <Field label="Start from" htmlFor={`${id}-tpl`}>
            <Select
              id={`${id}-tpl`}
              value={template}
              onChange={(e) => {
                const t = e.target.value as Template;
                setTemplate(t);
                setBody(textFor(t));
              }}
            >
              <option value="general">Blank message</option>
              <option value="absence">Absence follow-up</option>
              {canFees && <option value="fees">Fee reminder</option>}
              <option value="meeting">Request a meeting</option>
            </Select>
          </Field>
        </div>
        <Field
          label="Message"
          htmlFor={`${id}-body`}
          error={error}
          hint={channel === "app" ? `${body.length} characters · ${smsParts} SMS ${smsParts === 1 ? "part" : "parts"} if the app isn't installed` : `${body.length} characters`}
        >
          <Textarea id={`${id}-body`} value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
        </Field>
      </div>
    </Dialog>
  );
}
