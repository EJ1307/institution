"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Field, Input, Select } from "@/components/ui/forms";
import { useToast } from "@/components/ui/overlay";
import { Button, Card, CardFooter, CardHeader } from "@/components/ui/primitives";
import { academicYear } from "@/lib/data/calendar";
import { saveBrand, useBrand } from "@/lib/session";
import { setState, useAppState } from "@/lib/store";

export const PROFILE_DEFAULTS: Record<string, string> = {
  address: "Plot 7, Sector 57, Golf Course Extension Road",
  city: "Gurugram",
  state: "Haryana",
  pin: "122011",
  board: "CBSE",
  affiliation: "530412",
  schoolCode: "40512",
  udise: "06180412307",
  phone: "+91 124 4938 200",
  email: "office@amaltas.edu.in",
  website: "amaltas.edu.in",
  yearStart: "April",
  medium: "English",
};

type Form = Record<string, string>;

export function ProfileSection() {
  const id = useId();
  const toast = useToast();
  const brand = useBrand();
  const saved = useAppState((s) => s.settings.profile);
  const ay = academicYear();

  const initial = useMemo<Form>(() => ({ ...PROFILE_DEFAULTS, ...saved, school: brand.school, short: brand.short, location: brand.city }), [saved, brand.school, brand.short, brand.city]);
  const [f, setF] = useState<Form>(initial);
  const [errors, setErrors] = useState<Form>({});
  useEffect(() => setF(initial), [initial]);

  const dirty = Object.keys(f).some((k) => f[k] !== initial[k]);
  const set = (k: string, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const save = () => {
    const e: Form = {};
    if (f.school.trim().length < 4) e.school = "Enter the school's registered name.";
    if (!/^[A-Za-z]{2,6}$/.test(f.short.trim())) e.short = "2–6 letters, e.g. AIS.";
    if (!f.location.trim()) e.location = "Shown under the school name — e.g. Sector 57, Gurugram.";
    if (!/^\d{6}$/.test(f.pin)) e.pin = "PIN codes have 6 digits.";
    if (!/^\d{5,7}$/.test(f.affiliation)) e.affiliation = "Check the affiliation number on your CBSE letter.";
    if (!/^\d{11}$/.test(f.udise)) e.udise = "UDISE+ codes have 11 digits.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) e.email = "Enter a valid email address.";
    if (f.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a landline with STD code or a mobile number.";
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    const { school, short, location, ...profile } = f;
    setState((st) => ({ settings: { ...st.settings, profile } }));
    if (school !== brand.school || short !== brand.short || location !== brand.city) saveBrand({ ...brand, school: school.trim(), short: short.trim().toUpperCase(), city: location.trim() });
    toast({ title: "School profile saved", body: "New report cards, receipts and ID cards will use these details." });
  };

  const field = (k: string, label: string, opts: { hint?: string; placeholder?: string; className?: string; inputMode?: "numeric" | "email" | "tel" } = {}) => (
    <Field label={label} htmlFor={`${id}-${k}`} hint={opts.hint} error={errors[k]} className={opts.className}>
      <Input id={`${id}-${k}`} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={opts.placeholder} inputMode={opts.inputMode} aria-invalid={!!errors[k]} />
    </Field>
  );

  return (
    <Card>
      <CardHeader title="School profile" description="Printed on report cards, fee receipts, ID cards and transfer certificates, and shown in the parent app." />
      <div className="flex flex-col gap-6 px-5 pt-1 pb-6">
        <Group title="Identity">
          {field("school", "Registered name", { className: "sm:col-span-2" })}
          {field("short", "Short name", { hint: "Used on receipts and SMS sign-offs" })}
          {field("location", "Location line", { hint: "Shown under the name on sign-in and ID cards" })}
        </Group>
        <Group title="Address & contact">
          {field("address", "Address", { className: "sm:col-span-2" })}
          {field("city", "City")}
          <div className="grid grid-cols-2 gap-4">
            <Field label="State" htmlFor={`${id}-state`}>
              <Select id={`${id}-state`} value={f.state} onChange={(e) => set("state", e.target.value)}>
                {["Haryana", "Delhi", "Uttar Pradesh", "Rajasthan", "Punjab", "Maharashtra", "Karnataka"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            {field("pin", "PIN code", { inputMode: "numeric" })}
          </div>
          {field("phone", "Office phone", { inputMode: "tel" })}
          {field("email", "Office email", { inputMode: "email" })}
          {field("website", "Website")}
        </Group>
        <Group title="Affiliation & academic year">
          <Field label="Board" htmlFor={`${id}-board`}>
            <Select id={`${id}-board`} value={f.board} onChange={(e) => set("board", e.target.value)}>
              <option value="CBSE">CBSE — Central Board of Secondary Education</option>
              <option value="CISCE">CISCE — ICSE / ISC</option>
              <option value="HBSE">Board of School Education Haryana</option>
            </Select>
          </Field>
          {field("affiliation", "Affiliation no.", { inputMode: "numeric" })}
          {field("schoolCode", "School code", { inputMode: "numeric", hint: "Five-digit code on board admit cards" })}
          {field("udise", "UDISE+ code", { inputMode: "numeric", hint: "For the annual UDISE+ return" })}
          <Field label="Current academic year" htmlFor={`${id}-ay`} hint={`1 April ${ay.startYear} – 31 March ${ay.startYear + 1} · next year opens for admissions now`}>
            <Select id={`${id}-ay`} value={ay.label} onChange={() => undefined} disabled>
              <option>{ay.label}</option>
            </Select>
          </Field>
          <Field label="Medium of instruction" htmlFor={`${id}-medium`}>
            <Select id={`${id}-medium`} value={f.medium} onChange={(e) => set("medium", e.target.value)}>
              <option>English</option>
              <option>Hindi</option>
              <option>English & Hindi</option>
            </Select>
          </Field>
        </Group>
      </div>
      <CardFooter>
        <span>{dirty ? "You have unsaved changes." : "Last updated by Dr. Meenakshi Rao."}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => (setF(initial), setErrors({}))}>
            Discard
          </Button>
          <Button variant="primary" size="sm" disabled={!dirty} onClick={save}>
            Save changes
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-5 first:border-t-0 first:pt-2">
      <legend className="sr-only">{title}</legend>
      <div className="mb-3.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase" aria-hidden>
        {title}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
