"use client";

import { Check, Minus, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { Field, Input, Select } from "@/components/ui/forms";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, Card, CardHeader, cn } from "@/components/ui/primitives";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { staff, students } from "@/lib/data/people";
import { number } from "@/lib/format";

type RoleId = "principal" | "leadership" | "classTeacher" | "teacher" | "accounts" | "office" | "parent";

const ROLE_LABEL: Record<RoleId, string> = {
  principal: "Principal",
  leadership: "Leadership",
  classTeacher: "Class teacher",
  teacher: "Subject teacher",
  accounts: "Accounts",
  office: "Front office",
  parent: "Parent",
};

/** true = full access · string = scoped access · false = none */
type Cell = true | false | string;

const MATRIX: { group: string; rows: { label: string; cells: Record<RoleId, Cell> }[] }[] = [
  {
    group: "Students",
    rows: [
      { label: "View student profiles", cells: { principal: true, leadership: true, classTeacher: "Own classes", teacher: "Own classes", accounts: "Fee details", office: true, parent: "Own children" } },
      { label: "Edit student records", cells: { principal: true, leadership: true, classTeacher: false, teacher: false, accounts: false, office: true, parent: "Contact details" } },
      { label: "Verify documents", cells: { principal: true, leadership: false, classTeacher: false, teacher: false, accounts: false, office: true, parent: false } },
    ],
  },
  {
    group: "Academics",
    rows: [
      { label: "Mark attendance", cells: { principal: true, leadership: true, classTeacher: "Own class", teacher: "Own periods", accounts: false, office: false, parent: false } },
      { label: "Enter marks", cells: { principal: true, leadership: true, classTeacher: "Own subjects", teacher: "Own subjects", accounts: false, office: false, parent: false } },
      { label: "Publish results", cells: { principal: true, leadership: "Own wing", classTeacher: false, teacher: false, accounts: false, office: false, parent: false } },
    ],
  },
  {
    group: "Fees",
    rows: [
      { label: "Collect fees & issue receipts", cells: { principal: true, leadership: false, classTeacher: false, teacher: false, accounts: true, office: "Counter only", parent: "Pay online" } },
      { label: "Approve concessions & refunds", cells: { principal: true, leadership: false, classTeacher: false, teacher: false, accounts: "Propose", office: false, parent: false } },
    ],
  },
  {
    group: "Communication",
    rows: [
      { label: "Post notices to all parents", cells: { principal: true, leadership: true, classTeacher: "Own class", teacher: false, accounts: "Fee notices", office: false, parent: false } },
      { label: "Message parents directly", cells: { principal: true, leadership: true, classTeacher: true, teacher: "Own classes", accounts: true, office: true, parent: "Reply only" } },
    ],
  },
  {
    group: "Administration",
    rows: [
      { label: "Approve staff leave", cells: { principal: true, leadership: "Own wing", classTeacher: false, teacher: false, accounts: false, office: false, parent: false } },
      { label: "Manage admissions", cells: { principal: true, leadership: "View", classTeacher: false, teacher: false, accounts: "Fee step", office: true, parent: false } },
      { label: "Export data", cells: { principal: true, leadership: false, classTeacher: "Class lists", teacher: false, accounts: "Fee reports", office: false, parent: false } },
      { label: "School settings & roles", cells: { principal: true, leadership: false, classTeacher: false, teacher: false, accounts: false, office: false, parent: false } },
    ],
  },
];

export function RolesSection() {
  const toast = useToast();
  const people = staff();
  const by = (pred: (s: (typeof people)[number]) => boolean) => people.filter(pred);
  const parents = new Set(students().map((s) => s.parentId)).size;
  const roles: { id: RoleId; who: { name: string }[]; count: number; scope: string; signIn: string; twoFa: boolean }[] = [
    { id: "principal", who: by((s) => s.designation === "Principal"), count: 1, scope: "Whole school", signIn: "Email + authenticator app", twoFa: true },
    { id: "leadership", who: by((s) => s.category === "Leadership" && s.designation !== "Principal"), count: by((s) => s.category === "Leadership").length - 1, scope: "Whole school or their wing", signIn: "Email + authenticator app", twoFa: true },
    { id: "classTeacher", who: by((s) => !!s.classTeacherOf), count: by((s) => !!s.classTeacherOf).length, scope: "Own class, plus subjects taught", signIn: "School email + OTP", twoFa: true },
    { id: "teacher", who: by((s) => s.category !== "Leadership" && !s.classTeacherOf && s.subjects.length > 0), count: by((s) => s.category !== "Leadership" && !s.classTeacherOf && s.subjects.length > 0).length, scope: "Sections on their timetable", signIn: "School email + OTP", twoFa: true },
    { id: "accounts", who: by((s) => s.department === "Accounts"), count: by((s) => s.department === "Accounts").length, scope: "Fees, receipts, concessions", signIn: "Email + authenticator app", twoFa: true },
    { id: "office", who: by((s) => ["Admissions", "Administration"].includes(s.department)), count: by((s) => ["Admissions", "Administration"].includes(s.department)).length, scope: "Admissions, records, visitors", signIn: "School email + OTP", twoFa: true },
    { id: "parent", who: [], count: parents, scope: "Their own children only", signIn: "Mobile number + OTP", twoFa: false },
  ];
  const [inviting, setInviting] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Roles"
          description="Everyone signs in with their own account. Access follows the role and the classes on their timetable."
          action={
            <Button size="sm" variant="primary" onClick={() => setInviting(true)}>
              <UserPlus /> Invite staff
            </Button>
          }
        />
        <Table>
          <THead>
            <tr>
              <Th>Role</Th>
              <Th align="right">People</Th>
              <Th className="hidden md:table-cell">Can see</Th>
              <Th className="hidden lg:table-cell">Sign-in</Th>
            </tr>
          </THead>
          <tbody>
            {roles.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <div className="hidden w-[64px] -space-x-1 sm:flex">
                      {r.who.slice(0, 3).map((p) => (
                        <Avatar key={p.name} name={p.name} size={24} ring />
                      ))}
                      {r.id === "parent" && <Avatar name="Rohan Mehta" size={24} ring />}
                    </div>
                    <span className="font-medium text-ink">{ROLE_LABEL[r.id]}</span>
                  </div>
                </Td>
                <Td align="right" className="font-medium text-ink">
                  {number(r.count)}
                </Td>
                <Td className="hidden text-ink-2 md:table-cell">{r.scope}</Td>
                <Td className="hidden lg:table-cell">
                  <span className="text-ink-2">{r.signIn}</span>
                  {r.twoFa && <span className="block text-[12px] text-muted">Two-step verification required</span>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader title="Permissions" description="Default permissions for a CBSE school. Your account manager can tailor them — for example, letting coordinators approve concessions." action={<Badge tone="neutral">Read-only</Badge>} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-3 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-good" strokeWidth={2.5} /> Full access
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded bg-ink/[0.05] px-1.5 text-[11px] text-ink-2">Scoped</span> Limited to what&apos;s named
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Minus className="size-3.5 text-faint" /> No access
          </span>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[12.5px]">
            <thead className="bg-surface-2 text-[11.5px] font-semibold text-muted">
              <tr>
                <th scope="col" className="sticky left-0 z-10 h-9 border-y border-line bg-surface-2 pr-3 pl-5 text-left">
                  Capability
                </th>
                {(Object.keys(ROLE_LABEL) as RoleId[]).map((r) => (
                  <th key={r} scope="col" className="h-9 border-y border-line px-2 text-center whitespace-nowrap last:pr-5">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((g) => (
                <MatrixGroup key={g.group} group={g} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        onInvite={(email, role) => {
          setInviting(false);
          toast({ title: `Invitation sent to ${email}`, body: `They'll join as ${ROLE_LABEL[role as RoleId].toLowerCase()} and set up two-step verification on first sign-in.` });
        }}
      />
    </div>
  );
}

function MatrixGroup({ group }: { group: (typeof MATRIX)[number] }) {
  return (
    <>
      <tr>
        <td colSpan={8} className="sticky left-0 border-b border-line bg-surface px-5 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
          {group.group}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.label} className="border-b border-line last:border-b-0">
          <th scope="row" className="sticky left-0 z-10 h-10 bg-surface pr-3 pl-5 text-left font-normal whitespace-nowrap text-ink">
            {row.label}
          </th>
          {(Object.keys(ROLE_LABEL) as RoleId[]).map((r) => {
            const c = row.cells[r];
            return (
              <td key={r} className="px-2 text-center last:pr-5">
                {c === true ? (
                  <Check className="mx-auto size-4 text-good" strokeWidth={2.5} aria-label="Full access" />
                ) : c === false ? (
                  <Minus className="mx-auto size-3.5 text-faint" aria-label="No access" />
                ) : (
                  <span className={cn("inline-block rounded bg-ink/[0.05] px-1.5 py-0.5 text-[11px] leading-tight whitespace-nowrap text-ink-2")}>{c}</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function InviteDialog({ open, onClose, onInvite }: { open: boolean; onClose: () => void; onInvite: (email: string, role: string) => void }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleId>("teacher");
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    if (!/^[^\s@]+@amaltas\.edu\.in$/i.test(email.trim())) return setError("Use the person's school email — it must end in @amaltas.edu.in.");
    setError(null);
    onInvite(email.trim().toLowerCase(), role);
    setEmail("");
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Invite a staff member"
      description="They get an email to set a password and two-step verification."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Send invite
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="School email" htmlFor={`${id}-email`} error={error}>
          <Input id={`${id}-email`} type="email" value={email} onChange={(e) => (setEmail(e.target.value), setError(null))} placeholder="firstname.lastname@amaltas.edu.in" onKeyDown={(e) => e.key === "Enter" && submit()} />
        </Field>
        <Field label="Role" htmlFor={`${id}-role`}>
          <Select id={`${id}-role`} value={role} onChange={(e) => setRole(e.target.value as RoleId)}>
            {(Object.keys(ROLE_LABEL) as RoleId[])
              .filter((r) => r !== "parent" && r !== "principal")
              .map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}
