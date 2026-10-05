"use client";

import { Check, ClipboardCheck, IndianRupee, LayoutDashboard, RotateCcw, Upload, UsersRound } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Crest } from "@/components/shell/Crest";
import { Field, Input } from "@/components/ui/forms";
import { useToast } from "@/components/ui/overlay";
import { Button, Card, CardBody, CardFooter, CardHeader, cn } from "@/components/ui/primitives";
import { cssVarsFor, DEFAULT_BRAND, presetById, PRESETS, type BrandConfig, type BrandPreset } from "@/lib/brand";
import { saveBrand, useBrand } from "@/lib/session";

type Text = Pick<BrandConfig, "school" | "short" | "motto" | "mottoTranslation">;

export function BrandingSection() {
  const id = useId();
  const toast = useToast();
  const brand = useBrand();
  const [text, setText] = useState<Text>({ school: brand.school, short: brand.short, motto: brand.motto, mottoTranslation: brand.mottoTranslation });
  const [errors, setErrors] = useState<Partial<Text>>({});
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText({ school: brand.school, short: brand.short, motto: brand.motto, mottoTranslation: brand.mottoTranslation });
  }, [brand.school, brand.short, brand.motto, brand.mottoTranslation]);

  const preset = presetById(brand.presetId);
  const preview: BrandConfig = { ...brand, ...text };
  const dirty = text.school !== brand.school || text.short !== brand.short || text.motto !== brand.motto || text.mottoTranslation !== brand.mottoTranslation;

  const pick = (p: BrandPreset) => {
    if (p.id === brand.presetId) return;
    saveBrand({ ...brand, presetId: p.id });
    toast({ title: `Portal recoloured to ${p.name}`, body: "Every page, the sign-in screen and the parent app now use these colours." });
  };

  const saveText = () => {
    const e: Partial<Text> = {};
    if (text.school.trim().length < 4) e.school = "Enter the school's name.";
    if (!/^[A-Za-z]{2,6}$/.test(text.short.trim())) e.short = "2–6 letters.";
    if (!text.motto.trim()) e.motto = "Add a motto, or keep the current one.";
    setErrors(e);
    if (Object.keys(e).length) return;
    saveBrand({ ...brand, school: text.school.trim(), short: text.short.trim().toUpperCase(), motto: text.motto.trim(), mottoTranslation: text.mottoTranslation.trim() });
    toast({ title: "Name and motto saved", body: "The sidebar, sign-in page and ID cards are updated." });
  };

  const reset = () => {
    saveBrand(DEFAULT_BRAND);
    setErrors({});
    toast({ title: "Branding reset", body: "Back to the school's original name, motto and Amaltas green.", tone: "info" });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Colour theme"
          description="Pick a palette that matches your crest. It applies instantly for everyone — staff, parents and the sign-in page."
          action={
            <Button size="sm" variant="ghost" onClick={reset}>
              <RotateCcw /> Reset
            </Button>
          }
        />
        <CardBody>
          <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
            {PRESETS.map((p) => {
              const active = p.id === brand.presetId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => pick(p)}
                  className={cn(
                    "group rounded-xl border bg-surface p-2.5 text-left transition-[border-color,box-shadow]",
                    active ? "border-ink/70 shadow-[0_0_0_3px_rgb(23_25_28/0.08)]" : "border-line hover:border-line-strong",
                  )}
                >
                  <div className="flex h-12 overflow-hidden rounded-lg">
                    <span className="flex-[3]" style={{ background: p.deep }} />
                    <span className="flex-[2]" style={{ background: p.brand }} />
                    <span className="flex-1" style={{ background: p.accent }} />
                    <span className="flex-1" style={{ background: p.soft }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
                    <span className="truncate text-[12.5px] font-medium text-ink">{p.name}</span>
                    {active ? (
                      <span className="grid size-4 place-items-center rounded-full bg-ink text-white">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="size-4 rounded-full border border-line-strong" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <dl className="tnum mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-[12px] text-muted">
            {(
              [
                ["Primary", preset.brand],
                ["Sidebar", preset.deep],
                ["Accent", preset.accent],
                ["Tint", preset.soft],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="size-3 rounded-[3px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]" style={{ background: v }} />
                <dt>{k}</dt>
                <dd className="font-medium text-ink-2 uppercase">{v}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Live preview" description="How the portal and the sign-in page look with these settings" />
          <CardBody className="flex flex-col gap-3">
            <PortalPreview brand={preview} preset={preset} />
            <LoginPreview brand={preview} preset={preset} />
          </CardBody>
        </Card>

        <Card className="self-start">
          <CardHeader title="Name, crest & motto" description="White-label: your school's identity everywhere, with the platform credited only in the footer." />
          <div className="flex flex-col gap-4 px-5 pb-5">
            <div className="flex items-center gap-4 rounded-xl border border-line bg-surface-2 p-3.5">
              <span style={cssVarsFor(preset) as CSSProperties}>
                <Crest size={52} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">School crest</p>
                <p className="text-[12px] text-muted">SVG or a 512 px PNG on a transparent background</p>
              </div>
              <Button size="sm" onClick={() => file.current?.click()}>
                <Upload /> Replace
              </Button>
              <input
                ref={file}
                type="file"
                accept=".svg,.png"
                className="hidden"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const f0 = e.target.files?.[0];
                  e.target.value = "";
                  if (f0) toast({ title: `${f0.name} received`, body: "Our design team prepares a crisp version for print and app icons within 2 working days.", tone: "info" });
                }}
              />
            </div>
            <Field label="School name" htmlFor={`${id}-school`} error={errors.school}>
              <Input id={`${id}-school`} value={text.school} onChange={(e) => setText((t) => ({ ...t, school: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-[120px_1fr] gap-4">
              <Field label="Short name" htmlFor={`${id}-short`} error={errors.short}>
                <Input id={`${id}-short`} value={text.short} onChange={(e) => setText((t) => ({ ...t, short: e.target.value }))} />
              </Field>
              <Field label="Motto" htmlFor={`${id}-motto`} error={errors.motto} hint="Devanagari, Latin or English">
                <Input id={`${id}-motto`} lang="sa" value={text.motto} onChange={(e) => setText((t) => ({ ...t, motto: e.target.value }))} />
              </Field>
            </div>
            <Field label="Motto translation" htmlFor={`${id}-trans`}>
              <Input id={`${id}-trans`} value={text.mottoTranslation} onChange={(e) => setText((t) => ({ ...t, mottoTranslation: e.target.value }))} />
            </Field>
          </div>
          <CardFooter>
            <span>{dirty ? "The preview shows your unsaved changes." : `Platform credit: “Powered by ${brand.product}” in the sidebar footer.`}</span>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={!dirty}
                onClick={() => setText({ school: brand.school, short: brand.short, motto: brand.motto, mottoTranslation: brand.mottoTranslation })}
              >
                Discard
              </Button>
              <Button variant="primary" size="sm" disabled={!dirty} onClick={saveText}>
                Save
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function PortalPreview({ brand, preset }: { brand: BrandConfig; preset: BrandPreset }) {
  const vars = cssVarsFor(preset) as CSSProperties;
  const nav = [
    { icon: LayoutDashboard, label: "Dashboard", active: true },
    { icon: UsersRound, label: "Students" },
    { icon: ClipboardCheck, label: "Attendance" },
    { icon: IndianRupee, label: "Fees" },
  ];
  return (
    <div style={vars} className="overflow-hidden rounded-xl border border-line" aria-label="Portal preview" role="img">
      <div className="flex h-[212px]">
        <div className="flex w-[38%] max-w-[176px] shrink-0 flex-col bg-brand-deep px-2.5 py-3 text-white">
          <div className="mb-3 flex items-center gap-2 px-1">
            <Crest size={22} />
            <div className="min-w-0">
              <div className="title-serif truncate text-[11px] leading-tight font-semibold">{brand.school.replace(/ International School$/, "")}</div>
              <div className="truncate text-[8.5px] text-white/50">{brand.school.endsWith("International School") ? "International School" : brand.city}</div>
            </div>
          </div>
          {nav.map((n) => (
            <div key={n.label} className={cn("relative mb-0.5 flex h-6 items-center gap-2 rounded-md px-2 text-[10px]", n.active ? "bg-white/[0.11] text-white" : "text-white/65")}>
              {n.active && <span className="absolute top-1.5 bottom-1.5 -left-2.5 w-[2px] rounded-r-full bg-accent" />}
              <n.icon className={cn("size-3", n.active ? "text-accent" : "text-white/50")} />
              {n.label}
            </div>
          ))}
          <div className="mt-auto px-1 text-[8.5px] text-white/40">
            Powered by <span className="font-semibold text-white/60">{brand.product}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 bg-paper p-3.5">
          <div className="title-serif truncate text-[15px] font-semibold text-ink">Good morning, Dr. Rao</div>
          <div className="text-[9.5px] text-muted">Here&apos;s how {brand.school.split(" ")[0]} is doing today.</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-line bg-surface p-2">
              <div className="text-[8.5px] text-muted">Students present</div>
              <div className="text-[15px] font-semibold text-ink">94.2%</div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-brand-soft">
                <div className="h-full w-[94%] rounded-full bg-brand" />
              </div>
            </div>
            <div className="rounded-lg border border-line bg-surface p-2">
              <div className="text-[8.5px] text-muted">Fees collected</div>
              <div className="text-[15px] font-semibold text-ink">₹18.5 Cr</div>
              <div className="mt-1 inline-flex rounded-full bg-brand-soft px-1.5 text-[8px] font-medium text-brand">85% of billed</div>
            </div>
          </div>
          <div className="mt-3 flex gap-1.5">
            <span className="inline-flex h-6 items-center rounded-md bg-brand px-2 text-[9.5px] font-medium text-white">Post notice</span>
            <span className="inline-flex h-6 items-center rounded-md border border-line-strong bg-surface px-2 text-[9.5px] font-medium text-ink">Daily report</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginPreview({ brand, preset }: { brand: BrandConfig; preset: BrandPreset }) {
  const vars = cssVarsFor(preset) as CSSProperties;
  return (
    <div style={vars} className="overflow-hidden rounded-xl border border-line" aria-label="Sign-in page preview" role="img">
      <div className="flex h-[176px]">
        <div className="flex w-[50%] flex-col bg-brand-deep px-4 py-3.5 text-white">
          <div className="flex items-center gap-2">
            <Crest size={22} />
            <span className="title-serif truncate text-[10.5px] font-semibold">{brand.school}</span>
          </div>
          <div className="mt-auto">
            <p lang="sa" className="truncate text-[17px] leading-none text-accent" style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}>
              {brand.motto}
            </p>
            <p className="mt-1 truncate text-[8.5px] text-white/55 italic">“{brand.mottoTranslation}”</p>
            <p className="title-serif mt-3 text-[12px] leading-tight text-white">
              Everything about school, <span className="text-white/55">in one quiet place.</span>
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center bg-paper px-5">
          <div className="title-serif text-[14px] font-semibold text-ink">Sign in</div>
          <div className="text-[9px] text-muted">to the {brand.short} portal</div>
          <div className="mt-2.5 h-6 rounded-md border border-line-strong bg-surface" />
          <div className="mt-1.5 h-6 rounded-md border border-line-strong bg-surface" />
          <div className="mt-2.5 flex h-6 items-center justify-center rounded-md bg-brand text-[9.5px] font-medium text-white">Continue</div>
        </div>
      </div>
    </div>
  );
}
