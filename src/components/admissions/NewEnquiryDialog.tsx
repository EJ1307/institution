"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Checkbox, Field, Input, Segmented, Select, Textarea } from "@/components/ui/forms";
import { Dialog } from "@/components/ui/overlay";
import { Button, cn } from "@/components/ui/primitives";
import { SEATS, SOURCES } from "@/lib/data/admissions";
import { academicYear } from "@/lib/data/calendar";
import { LOCALITIES } from "@/lib/data/names";
import { GRADES, type GradeId } from "@/lib/data/school";
import { fmtAge } from "@/components/students/shared";
import { ageCutoff, minAgeFor } from "./model";

export type EnquiryInput = {
  child: string;
  gender: "F" | "M";
  dob: string;
  grade: GradeId;
  parent: string;
  phone: string;
  email: string;
  locality: string;
  source: string;
  sibling: boolean;
  note: string;
};

type Form = Omit<EnquiryInput, "gender" | "grade"> & { gender: "F" | "M" | ""; grade: GradeId | "" };

const EMPTY: Form = { child: "", gender: "", dob: "", grade: "", parent: "", phone: "", email: "", locality: "", source: "Walk-in", sibling: false, note: "" };

export function NewEnquiryDialog({ open, onClose, onCreate, filled }: { open: boolean; onClose: () => void; onCreate: (e: EnquiryInput) => void; filled: Partial<Record<GradeId, number>> }) {
  const id = useId();
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const ay = academicYear();
  const cutoff = ageCutoff();

  useEffect(() => {
    if (open) {
      setF(EMPTY);
      setErrors({});
      setSaving(false);
    }
  }, [open]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const age = f.dob ? new Date(f.dob) : null;
  const ageOk = age && f.grade ? (cutoff.getTime() - age.getTime()) / (365.25 * 86400000) >= minAgeFor(f.grade) : null;

  const validate = () => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (f.child.trim().split(/\s+/).length < 2) e.child = "Enter the child's first name and surname.";
    if (!f.gender) e.gender = "Select one.";
    if (!f.grade) e.grade = "Choose the class.";
    if (!f.dob) e.dob = "Needed to check age eligibility.";
    else if (new Date(f.dob) > new Date()) e.dob = "That date is in the future.";
    else if (ageOk === false) e.dob = `Under the minimum age for this class (${minAgeFor(f.grade as GradeId)}+ years on 31 Mar ${cutoff.getFullYear()}).`;
    if (f.parent.trim().length < 3) e.parent = "Enter a parent's name.";
    const digits = f.phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    if (!/^[6-9]\d{9}$/.test(digits)) e.phone = "Enter a 10-digit Indian mobile number.";
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) e.email = "That email address doesn't look right.";
    if (!f.locality) e.locality = "Choose where the family lives.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setTimeout(() => {
      const digits = f.phone.replace(/\D/g, "").slice(-10);
      onCreate({ ...f, child: f.child.trim().replace(/\s+/g, " "), parent: f.parent.trim(), phone: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`, gender: f.gender as "F" | "M", grade: f.grade as GradeId });
    }, 500);
  };

  const formId = `${id}-form`;
  const openGrades = GRADES.filter((g) => SEATS[g.id]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="New enquiry"
      description={`For admission in AY ${ay.nextLabel}. The assigned counsellor calls back within one working day.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={saving}>
            Add enquiry
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Child's full name *" htmlFor={`${id}-child`} error={errors.child} className="sm:col-span-2">
          <Input className="aria-invalid:border-bad" id={`${id}-child`} value={f.child} onChange={(e) => set("child", e.target.value)} placeholder="e.g. Myra Khanna" autoComplete="off" aria-invalid={!!errors.child} />
        </Field>
        <Field label="Gender *" error={errors.gender}>
          <Segmented
            label="Gender"
            value={f.gender || ("" as "F")}
            onChange={(v) => set("gender", v)}
            options={[
              { value: "F", label: "Girl" },
              { value: "M", label: "Boy" },
            ]}
            className="self-start"
          />
        </Field>
        <Field label="Applying for *" htmlFor={`${id}-grade`} error={errors.grade}>
          <Select id={`${id}-grade`} value={f.grade} onChange={(e) => set("grade", e.target.value as GradeId)} aria-invalid={!!errors.grade}>
            <option value="">Select class…</option>
            {openGrades.map((g) => {
              const left = (SEATS[g.id] ?? 0) - (filled[g.id] ?? 0);
              return (
                <option key={g.id} value={g.id}>
                  {g.label} · {left > 0 ? `${left} seats open` : "waitlist"}
                </option>
              );
            })}
          </Select>
        </Field>
        <Field
          label="Date of birth *"
          htmlFor={`${id}-dob`}
          error={errors.dob}
          hint={
            age && f.grade ? (
              <span className={cn(ageOk ? "text-good" : "text-warn")}>
                {fmtAge(age, cutoff)} on 31 Mar {cutoff.getFullYear()} — {ageOk ? "eligible" : `needs ${minAgeFor(f.grade as GradeId)}+`}
              </span>
            ) : (
              `Age is checked as on 31 March ${cutoff.getFullYear()}`
            )
          }
        >
          <Input className="aria-invalid:border-bad" id={`${id}-dob`} type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} max={new Date().toISOString().slice(0, 10)} aria-invalid={!!errors.dob} />
        </Field>
        <Field label="How did they hear about us?" htmlFor={`${id}-src`}>
          <Select id={`${id}-src`} value={f.source} onChange={(e) => set("source", e.target.value)}>
            {SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>

        <div className="border-t border-line pt-4 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase sm:col-span-2">Parent</div>
        <Field label="Parent's name *" htmlFor={`${id}-parent`} error={errors.parent}>
          <Input className="aria-invalid:border-bad" id={`${id}-parent`} value={f.parent} onChange={(e) => set("parent", e.target.value)} aria-invalid={!!errors.parent} />
        </Field>
        <Field label="Mobile *" htmlFor={`${id}-phone`} error={errors.phone}>
          <div className="flex">
            <span className="inline-flex h-9 items-center rounded-l-lg border border-r-0 border-line-strong/90 bg-surface-2 px-2.5 text-[13px] text-muted">+91</span>
            <Input id={`${id}-phone`} inputMode="numeric" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="98100 00000" className="aria-invalid:border-bad rounded-l-none" aria-invalid={!!errors.phone} />
          </div>
        </Field>
        <Field label="Email" htmlFor={`${id}-email`} error={errors.email}>
          <Input className="aria-invalid:border-bad" id={`${id}-email`} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Locality *" htmlFor={`${id}-loc`} error={errors.locality}>
          <Select id={`${id}-loc`} value={f.locality} onChange={(e) => set("locality", e.target.value)} aria-invalid={!!errors.locality}>
            <option value="">Select…</option>
            {LOCALITIES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="Notes for the counsellor" htmlFor={`${id}-note`} className="sm:col-span-2">
          <Textarea id={`${id}-note`} value={f.note} onChange={(e) => set("note", e.target.value)} rows={2} placeholder="e.g. Moving from Pune in March; wants to see the swimming pool" className="min-h-16" />
        </Field>
        <Checkbox checked={f.sibling} onChange={(v) => set("sibling", v)} label="A sibling already studies at the school" className="sm:col-span-2" />
      </form>
    </Dialog>
  );
}
