"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./primitives";

const fieldBase =
  "w-full rounded-lg border border-line-strong/90 bg-surface text-[13.5px] text-ink placeholder:text-faint shadow-[inset_0_1px_1px_rgb(0_0_0/0.02)] transition-[border-color,box-shadow] duration-150 hover:border-[#c4c0b5] focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-[color-mix(in_oklab,var(--brand)_16%,transparent)] disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-9 px-3", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-24 px-3 py-2 leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, children, ...rest }, ref) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select ref={ref} className={cn(fieldBase, "h-9 appearance-none pr-8 pl-3")} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </span>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? <p className="text-[12px] text-bad">{error}</p> : hint ? <p className="text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(fieldBase, "h-9 pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Segmented control — for 2–5 mutually exclusive views. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
  size?: "sm" | "md";
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg bg-ink/[0.055] p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[12.5px]",
              active ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_0.5px_rgb(0_0_0/0.06)]" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cn("tnum text-[11px]", active ? "text-muted" : "text-faint")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Underline tabs — for switching sections of a page. */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("scroll-thin flex gap-5 overflow-x-auto border-b border-line", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 text-[13px] font-medium whitespace-nowrap transition-colors",
              active ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("tnum rounded-full px-1.5 text-[11px] leading-[18px]", active ? "bg-brand-soft text-brand" : "bg-ink/5 text-muted")}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-2", className)}>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer size-4 appearance-none rounded-[5px] border border-line-strong bg-surface transition-colors checked:border-brand checked:bg-brand focus-visible:outline-2 focus-visible:outline-brand" />
        <Check className="pointer-events-none absolute inset-0 m-auto size-3 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
      </span>
      {label}
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-line-strong")}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
    </button>
  );
}
