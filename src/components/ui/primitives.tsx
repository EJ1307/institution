"use client";

import { clsx } from "clsx";
import { ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { hashInt } from "@/lib/rng";
import { initials } from "@/lib/format";

export const cn = clsx;

// ——— Button ————————————————————————————————————————————————————

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-[background-color,border-color,color,box-shadow,filter] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_0_0/0.12)] hover:brightness-[1.08] active:brightness-95",
  secondary: "bg-surface text-ink border border-line-strong/80 shadow-[0_1px_1px_rgb(0_0_0/0.03)] hover:bg-surface-2 hover:border-line-strong",
  ghost: "text-ink-2 hover:bg-ink/[0.05] hover:text-ink",
  subtle: "bg-brand-soft text-brand hover:bg-[color-mix(in_oklab,var(--brand-soft),var(--brand)_8%)]",
  danger: "bg-bad text-white hover:brightness-110",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[12.5px] [&_svg]:size-3.5",
  md: "h-9 px-3.5 text-[13px] [&_svg]:size-4",
  lg: "h-11 px-5 text-[14px] [&_svg]:size-4",
  icon: "size-9 [&_svg]:size-[18px]",
  "icon-sm": "size-8 [&_svg]:size-4",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

// ——— Card ——————————————————————————————————————————————————————

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-muted [&_svg]:size-4">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold leading-5 text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[12.5px] leading-[18px] text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <footer className={cn("flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12.5px] text-muted", className)}>{children}</footer>;
}

// ——— Badge ——————————————————————————————————————————————————————

export type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "brand" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-ink/[0.05] text-ink-2",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  brand: "bg-brand-soft text-brand",
  outline: "border border-line-strong text-ink-2",
};

const dotTones: Record<Tone, string> = {
  neutral: "bg-faint",
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  info: "bg-info",
  brand: "bg-brand",
  outline: "bg-faint",
};

export function Badge({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium leading-none", tones[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", dotTones[tone])} />}
      {children}
    </span>
  );
}

// ——— Avatar ——————————————————————————————————————————————————————

const AVATAR_TONES = [
  ["#E7E0D1", "#5E5236"],
  ["#DCE8E1", "#2F5B47"],
  ["#E0E6F1", "#34507F"],
  ["#F1E1DA", "#7E4232"],
  ["#EAE2EF", "#5A4470"],
  ["#E3EDEE", "#2D5F63"],
  ["#F2E9D2", "#76581C"],
];

export function Avatar({ name, size = 32, className, ring }: { name: string; size?: number; className?: string; ring?: boolean }) {
  const [bg, fg] = AVATAR_TONES[hashInt(name) % AVATAR_TONES.length];
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold", ring && "ring-2 ring-surface", className)}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.max(10, Math.round(size * 0.36)), letterSpacing: "0.02em" }}
    >
      {initials(name)}
    </span>
  );
}

// ——— Delta & Meter ————————————————————————————————————————————————

/** Signed change; colour = direction × whether up is good. */
export function Delta({ value, format, upIsGood = true, suffix }: { value: number; format: (n: number) => string; upIsGood?: boolean; suffix?: string }) {
  const up = value > 0;
  const flat = Math.abs(value) < 1e-9;
  const good = flat ? null : up === upIsGood;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-medium", good === null ? "text-muted" : good ? "text-good" : "text-bad")}>
      {!flat && (up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />)}
      <span>
        {up ? "+" : flat ? "" : "−"}
        {format(Math.abs(value))}
      </span>
      {suffix && <span className="font-normal text-muted">&nbsp;{suffix}</span>}
    </span>
  );
}

export function Meter({ value, tone = "brand", className, label }: { value: number; tone?: "brand" | "good" | "warn" | "bad"; className?: string; label?: string }) {
  const fill = { brand: "bg-brand", good: "bg-good", warn: "bg-[#D9961F]", bad: "bg-bad" }[tone];
  const track = { brand: "bg-brand-soft", good: "bg-good-soft", warn: "bg-warn-soft", bad: "bg-bad-soft" }[tone];
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full", track, className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface px-1 font-sans text-[10.5px] font-medium text-muted shadow-[0_1px_0_var(--line-strong)]">
      {children}
    </kbd>
  );
}

export function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 rounded-full", className)} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}
