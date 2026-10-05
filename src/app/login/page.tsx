"use client";

import { ArrowRight, BookOpen, Eye, EyeOff, LockKeyhole, ShieldCheck, Smartphone, UserRound, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Crest } from "@/components/shell/Crest";
import { Button, cn } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/forms";
import { academicYear } from "@/lib/data/calendar";
import { PERSONAS, signIn, useBrand } from "@/lib/session";
import { getState, type Role } from "@/lib/store";

const ROLES: { id: Role; label: string; icon: typeof UserRound; blurb: string }[] = [
  { id: "admin", label: "Leadership", icon: ShieldCheck, blurb: "Principal, management & office staff" },
  { id: "teacher", label: "Teacher", icon: BookOpen, blurb: "Class & subject teachers" },
  { id: "parent", label: "Parent", icon: UsersRound, blurb: "Sign in with your registered mobile" },
];

export default function LoginPage() {
  const router = useRouter();
  const brand = useBrand();
  const [role, setRole] = useState<Role>("admin");
  const [email, setEmail] = useState(PERSONAS.admin.login);
  const [password, setPassword] = useState("demo-password");
  const [show, setShow] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ay = academicYear();

  useEffect(() => {
    if (getState().session) router.replace("/dashboard");
  }, [router]);

  useEffect(() => {
    setError(null);
    setOtpSent(false);
    setOtp("");
    setEmail(PERSONAS[role].login);
  }, [role]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (role === "parent" && !otpSent) {
      if (email.replace(/\D/g, "").length < 10) return setError("Enter your 10-digit registered mobile number.");
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setOtpSent(true);
      }, 650);
      return;
    }
    if (role === "parent" && otp.length < 6) return setError("Enter the 6-digit code we sent you.");
    if (role !== "parent" && (!email.includes("@") || !password)) return setError("Enter your school email and password.");
    setError(null);
    setLoading(true);
    setTimeout(() => {
      signIn(role);
      router.push("/dashboard");
    }, 700);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:flex-row">
      {/* Brand panel */}
      <aside className="relative overflow-hidden bg-brand-deep text-white lg:flex lg:w-[46%] lg:max-w-[680px] lg:flex-col">
        <Pattern />
        <div className="relative flex items-center gap-3 px-6 py-5 lg:px-12 lg:pt-12">
          <Crest size={44} />
          <div>
            <div className="title-serif text-[17px] leading-tight font-semibold">{brand.school}</div>
            <div className="text-[12px] text-white/55">{brand.city} · Affiliated to CBSE</div>
          </div>
        </div>

        <div className="relative hidden flex-1 flex-col justify-center px-12 lg:flex">
          <p className="text-[34px] leading-none text-accent" lang="sa" style={{ fontFamily: "'Tiro Devanagari Hindi', serif" }}>
            {brand.motto}
          </p>
          <p className="mt-3 text-[13px] tracking-[0.04em] text-white/55 italic">“{brand.mottoTranslation}”</p>
          <h1 className="title-serif mt-14 max-w-[460px] text-[40px] leading-[1.08] font-medium tracking-[-0.02em] text-white">
            Everything about school, <span className="text-white/55">in one quiet place.</span>
          </h1>
          <p className="mt-5 max-w-[440px] text-[14.5px] leading-relaxed text-white/65">
            Attendance, fees, report cards, the bus and every notice from school — for leadership, teachers and families.
          </p>
        </div>

        <div className="relative hidden items-center justify-between gap-6 border-t border-white/10 px-12 py-6 text-[12px] text-white/50 lg:flex">
          <span>Academic year {ay.label}</span>
          <span className="flex items-center gap-1.5">
            <LockKeyhole className="size-3.5" /> Encrypted · data stored in India
          </span>
        </div>
      </aside>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:py-16">
        <div className="w-full max-w-[420px]">
          <h2 className="title-serif text-[30px] leading-tight font-semibold">Sign in</h2>
          <p className="mt-1.5 text-[14px] text-muted">to the {brand.short} portal</p>

          <div role="radiogroup" aria-label="Sign in as" className="mt-8 grid grid-cols-3 gap-2">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const active = r.id === role;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRole(r.id)}
                  className={cn(
                    "flex flex-col items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition-[border-color,background-color,box-shadow]",
                    active ? "border-brand bg-surface shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_14%,transparent)]" : "border-line bg-surface/60 hover:border-line-strong hover:bg-surface",
                  )}
                >
                  <Icon className={cn("size-[18px]", active ? "text-brand" : "text-muted")} strokeWidth={1.9} />
                  <span className={cn("text-[13px] font-medium", active ? "text-ink" : "text-ink-2")}>{r.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-[12.5px] text-muted">{ROLES.find((r) => r.id === role)!.blurb}</p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
            {role === "parent" ? (
              <>
                <Field label="Registered mobile number" htmlFor="phone">
                  <div className="flex">
                    <span className="inline-flex h-9 items-center rounded-l-lg border border-r-0 border-line-strong/90 bg-surface-2 px-3 text-[13.5px] text-muted">+91</span>
                    <Input id="phone" inputMode="numeric" autoComplete="tel-national" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-l-none" disabled={otpSent} />
                  </div>
                </Field>
                {otpSent && <OtpInput value={otp} onChange={setOtp} />}
              </>
            ) : (
              <>
                <Field label="School email" htmlFor="email">
                  <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
                <Field label="Password" htmlFor="password">
                  <div className="relative">
                    <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                    <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
                <div className="-mt-1 flex items-center justify-between text-[12.5px]">
                  <label className="inline-flex items-center gap-2 text-ink-2">
                    <input type="checkbox" defaultChecked className="size-3.5 accent-[var(--brand)]" /> Keep me signed in
                  </label>
                  <button type="button" className="font-medium text-brand hover:underline">
                    Forgot password?
                  </button>
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-1 w-full">
              {role === "parent" && !otpSent ? (
                <>
                  <Smartphone /> Send one-time code
                </>
              ) : (
                <>
                  Sign in <ArrowRight />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-dashed border-line-strong bg-surface/70 px-4 py-3 text-[12.5px] leading-relaxed text-muted">
            <span className="font-medium text-ink-2">Demo environment.</span> Pick a role and sign in — the details are pre-filled
            {role === "parent" ? <> and the code is <span className="tnum font-semibold text-ink">246810</span></> : null}. Nothing here is real student data.
          </div>

          <p className="mt-10 text-center text-[12px] text-faint">
            © {new Date().getFullYear()} {brand.school} · Powered by {brand.product}
          </p>
        </div>
      </main>
    </div>
  );
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    // the demo "receives" the code after a moment, like SMS autofill
    const t = setTimeout(() => onChange("246810"), 900);
    refs.current[0]?.focus();
    return () => clearTimeout(t);
  }, [onChange]);
  const set = (i: number, ch: string) => {
    const digits = value.padEnd(6, " ").split("");
    digits[i] = ch || " ";
    onChange(digits.join("").replace(/\s+$/, ""));
    if (ch && i < 5) refs.current[i + 1]?.focus();
  };
  return (
    <fieldset>
      <legend className="mb-1.5 text-[12.5px] font-medium text-ink-2">Enter the 6-digit code sent to your phone</legend>
      <div className="flex gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            maxLength={1}
            aria-label={`Digit ${i + 1}`}
            value={value[i]?.trim() ?? ""}
            onChange={(e) => set(i, e.target.value.replace(/\D/g, "").slice(-1))}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
            }}
            className="tnum h-12 w-full min-w-0 rounded-lg border border-line-strong/90 bg-surface text-center text-[18px] font-semibold focus:border-brand focus:ring-[3px] focus:ring-[color-mix(in_oklab,var(--brand)_16%,transparent)] focus:outline-none"
          />
        ))}
      </div>
      <p className="mt-2 text-[12px] text-muted">Didn&apos;t get it? You can resend in 0:24.</p>
    </fieldset>
  );
}

/** Quiet decorative pattern: falling amaltas blossoms as fine dots on a large arc. */
function Pattern() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 600 900">
      <defs>
        <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1" fill="white" fillOpacity="0.06" />
        </pattern>
      </defs>
      <rect width="600" height="900" fill="url(#dots)" />
      <circle cx="610" cy="860" r="330" fill="none" stroke="var(--accent)" strokeOpacity="0.14" />
      <circle cx="610" cy="860" r="250" fill="none" stroke="var(--accent)" strokeOpacity="0.1" />
      <circle cx="610" cy="860" r="170" fill="none" stroke="var(--accent)" strokeOpacity="0.07" />
      {Array.from({ length: 14 }, (_, i) => {
        const a = (Math.PI * (1.02 + i * 0.038));
        const r2 = (n: number) => Math.round(n * 100) / 100;
        return <circle key={i} cx={r2(610 + Math.cos(a) * 330)} cy={r2(860 + Math.sin(a) * 330)} r={r2(7 - i * 0.38)} fill="var(--accent)" fillOpacity={r2(0.5 - i * 0.03)} />;
      })}
    </svg>
  );
}
