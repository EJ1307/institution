"use client";

import { CheckCircle2, Info, X } from "lucide-react";
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "./primitives";

// ——— Dialog (native <dialog>: focus trap + Esc for free) —————————————————

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  side,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** render as a right-hand sheet instead of a centred modal */
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-[rgb(18_20_22/0.42)] backdrop:backdrop-blur-[1px] open:animate-pop-in",
        side && "my-0 mr-0 ml-auto h-dvh max-h-dvh rounded-none rounded-l-2xl sm:w-[480px]",
        !side && { sm: "sm:max-w-[400px]", md: "sm:max-w-[520px]", lg: "sm:max-w-[720px]" }[size],
      )}
    >
      {open && (
        <div className={cn("flex max-h-[inherit] flex-col", side && "h-full")}>
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="-mr-1.5 grid size-8 place-items-center rounded-lg text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </button>
          </header>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

// ——— Popover menu ——————————————————————————————————————————————————

export function Menu({
  trigger,
  children,
  align = "end",
  width = 220,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  width?: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const left = align === "end" ? r.right - width : r.left;
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {trigger({ open, toggle: () => setOpen((o) => !o), ref: btn })}
      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            aria-label={label}
            className="animate-pop-in fixed z-50 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-pop)]"
            style={{ top: pos.top, left: pos.left, width }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({ onClick, children, icon, tone, hint }: { onClick?: () => void; children: ReactNode; icon?: ReactNode; tone?: "bad"; hint?: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-ink/[0.045] focus-visible:bg-ink/[0.045] focus-visible:outline-none [&_svg]:size-4",
        tone === "bad" ? "text-bad" : "text-ink-2 hover:text-ink",
      )}
    >
      {icon && <span className="text-muted">{icon}</span>}
      <span className="min-w-0 flex-1">{children}</span>
      {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">{children}</div>;
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />;
}

// ——— Toasts ————————————————————————————————————————————————————————

type Toast = { id: number; title: string; body?: string; tone: "good" | "info" };
const ToastCtx = createContext<(t: Omit<Toast, "id" | "tone"> & { tone?: Toast["tone"] }) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id" | "tone"> & { tone?: Toast["tone"] }) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all.slice(-2), { tone: "good", ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 left-4 z-[60] flex flex-col items-end gap-2 sm:left-auto">
        {toasts.map((t) => (
          <div key={t.id} className="animate-pop-in pointer-events-auto flex w-full max-w-[360px] items-start gap-3 rounded-xl bg-ink px-4 py-3 text-white shadow-[var(--shadow-pop)]">
            {t.tone === "good" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#7fd3a8]" /> : <Info className="mt-0.5 size-4 shrink-0 text-[#9dbbe8]" />}
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[12.5px] text-white/70">{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
