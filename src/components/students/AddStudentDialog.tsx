"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Checkbox, Field, Input, Segmented, Select } from "@/components/ui/forms";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Button } from "@/components/ui/primitives";
import { academicYear } from "@/lib/data/calendar";
import { LOCALITIES } from "@/lib/data/names";
import { studentsInClass } from "@/lib/data/people";
import { CLASSES, GRADE_BY_ID, classLabel, classLabelLong } from "@/lib/data/school";
import { ageOn } from "./shared";

type Form = {
  first: string;
  last: string;
  gender: "F" | "M" | "";
  dob: string;
  classKey: string;
  guardian: string;
  relation: "Father" | "Mother" | "Guardian";
  phone: string;
  email: string;
  locality: string;
  bus: boolean;
  previous: string;
};

const EMPTY: Form = { first: "", last: "", gender: "", dob: "", classKey: "", guardian: "", relation: "Father", phone: "", email: "", locality: "", bus: false, previous: "" };

/** Minimum age (completed years on 31 March of the admission year) for each grade — CBSE / Haryana norms. */
function minAge(classKey: string) {
  const g = GRADE_BY_ID[classKey.split("-")[0] as keyof typeof GRADE_BY_ID];
  return g ? 3 + g.order : 3;
}

export function AddStudentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const id = useId();
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const ay = academicYear();

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

  const validate = () => {
    const e: Partial<Record<keyof Form, string>> = {};
    const name = /^[\p{L}][\p{L} .'-]*$/u;
    if (!f.first.trim()) e.first = "Enter the student's first name.";
    else if (!name.test(f.first.trim())) e.first = "Use letters only.";
    if (!f.last.trim()) e.last = "Enter the surname as on the birth certificate.";
    else if (!name.test(f.last.trim())) e.last = "Use letters only.";
    if (!f.gender) e.gender = "Select one.";
    if (!f.classKey) e.classKey = "Choose the class and section.";
    if (!f.dob) e.dob = "Enter the date of birth.";
    else {
      const dob = new Date(f.dob);
      if (Number.isNaN(dob.getTime()) || dob > new Date()) e.dob = "That date is in the future.";
      else if (f.classKey) {
        const age = ageOn(dob, new Date(ay.startYear, 2, 31)).years;
        const need = minAge(f.classKey);
        if (age < need) e.dob = `Too young for ${classLabel(f.classKey.split("-")[0] as never, f.classKey.split("-")[1])} — needs ${need}+ years on 31 Mar ${ay.startYear}.`;
        else if (age > need + 3) e.dob = `Unusually old for this class (${age} years). Check the date or the class.`;
      }
    }
    if (!f.guardian.trim()) e.guardian = "Enter a parent or guardian's name.";
    const digits = f.phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    if (!digits) e.phone = "A mobile number is needed for SMS and app login.";
    else if (!/^[6-9]\d{9}$/.test(digits)) e.phone = "Enter a 10-digit Indian mobile number.";
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) e.email = "That email address doesn't look right.";
    if (!f.locality) e.locality = "Choose the area the family lives in.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setTimeout(() => {
      const [g, sec] = f.classKey.split("-");
      const roll = studentsInClass(f.classKey).length + 1;
      const adm = `AIS/${ay.startYear}/${String(1600 + Math.floor(Math.random() * 300)).padStart(4, "0")}`;
      toast({
        title: `${f.first.trim()} ${f.last.trim()} added to ${classLabel(g as never, sec)}`,
        body: `Admission no. ${adm} · Roll ${roll}. Login details have been sent to ${f.guardian.trim().split(" ")[0]} on +91 ${f.phone.replace(/\D/g, "").slice(-10).replace(/(\d{5})(\d{5})/, "$1 $2")}.`,
      });
      onClose();
    }, 650);
  };

  const formId = `${id}-form`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Add a student"
      description={`New admission for AY ${ay.label}. Fields marked * are required.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={saving}>
            Add student
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Student</legend>
          <Field label="First name *" htmlFor={`${id}-first`} error={errors.first}>
            <Input className="aria-invalid:border-bad" id={`${id}-first`} value={f.first} onChange={(e) => set("first", e.target.value)} autoComplete="off" aria-invalid={!!errors.first} />
          </Field>
          <Field label="Surname *" htmlFor={`${id}-last`} error={errors.last}>
            <Input className="aria-invalid:border-bad" id={`${id}-last`} value={f.last} onChange={(e) => set("last", e.target.value)} autoComplete="off" aria-invalid={!!errors.last} />
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
          <Field label="Date of birth *" htmlFor={`${id}-dob`} error={errors.dob} hint="As on the birth certificate">
            <Input className="aria-invalid:border-bad" id={`${id}-dob`} type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} max={new Date().toISOString().slice(0, 10)} aria-invalid={!!errors.dob} />
          </Field>
          <Field label="Class & section *" htmlFor={`${id}-class`} error={errors.classKey}>
            <Select id={`${id}-class`} value={f.classKey} onChange={(e) => set("classKey", e.target.value)} aria-invalid={!!errors.classKey}>
              <option value="">Select…</option>
              {CLASSES.map((c) => (
                <option key={c.key} value={c.key}>
                  {classLabelLong(c.grade, c.section)} · {studentsInClass(c.key).length} on roll
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Previous school" htmlFor={`${id}-prev`} hint="Leave blank for a first-time admission">
            <Input id={`${id}-prev`} value={f.previous} onChange={(e) => set("previous", e.target.value)} placeholder="e.g. DPS Sushant Lok" />
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <legend className="sr-only">Parent or guardian</legend>
          <div className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase sm:col-span-2">Parent / guardian</div>
          <Field label="Full name *" htmlFor={`${id}-guardian`} error={errors.guardian}>
            <Input className="aria-invalid:border-bad" id={`${id}-guardian`} value={f.guardian} onChange={(e) => set("guardian", e.target.value)} aria-invalid={!!errors.guardian} />
          </Field>
          <Field label="Relation" htmlFor={`${id}-rel`}>
            <Select id={`${id}-rel`} value={f.relation} onChange={(e) => set("relation", e.target.value as Form["relation"])}>
              <option>Father</option>
              <option>Mother</option>
              <option>Guardian</option>
            </Select>
          </Field>
          <Field label="Mobile *" htmlFor={`${id}-phone`} error={errors.phone} hint="Used for SMS alerts and the parent app">
            <div className="flex">
              <span className="inline-flex h-9 items-center rounded-l-lg border border-r-0 border-line-strong/90 bg-surface-2 px-2.5 text-[13px] text-muted">+91</span>
              <Input
                id={`${id}-phone`}
                inputMode="numeric"
                value={f.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="98100 00000"
                className="rounded-l-none"
                aria-invalid={!!errors.phone}
              />
            </div>
          </Field>
          <Field label="Email" htmlFor={`${id}-email`} error={errors.email}>
            <Input className="aria-invalid:border-bad" id={`${id}-email`} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" aria-invalid={!!errors.email} />
          </Field>
          <Field label="Locality *" htmlFor={`${id}-loc`} error={errors.locality}>
            <Select id={`${id}-loc`} value={f.locality} onChange={(e) => set("locality", e.target.value)} aria-invalid={!!errors.locality}>
              <option value="">Select…</option>
              {LOCALITIES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox checked={f.bus} onChange={(v) => set("bus", v)} label="Needs a seat on the school bus" />
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
