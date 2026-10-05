"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button, cn } from "./primitives";

/** Horizontally scrollable table wrapper with consistent type and rules. */
export function Table({ className, children, ...rest }: ComponentProps<"table">) {
  return (
    <div className="scroll-thin w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-[13px]", className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children, sticky }: { children: ReactNode; sticky?: boolean }) {
  return <thead className={cn("bg-surface-2 text-[11.5px] font-semibold tracking-[0.02em] text-muted", sticky && "sticky top-0 z-10")}>{children}</thead>;
}

export function Th({ className, children, align, ...rest }: ComponentProps<"th"> & { align?: "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-9 border-y border-line px-3 font-semibold whitespace-nowrap first:pl-5 last:pr-5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function SortTh<K extends string>({
  label,
  k,
  sort,
  onSort,
  align,
  className,
}: {
  label: ReactNode;
  k: K;
  sort: { key: K; dir: "asc" | "desc" };
  onSort: (k: K) => void;
  align?: "right";
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <Th align={align} className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink", align === "right" && "flex-row-reverse")}>
        {label}
        {active ? sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <span className="size-3" />}
      </button>
    </Th>
  );
}

export function Tr({ className, children, onClick, ...rest }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-b border-line last:border-b-0 transition-colors", onClick && "cursor-pointer hover:bg-surface-2", className)}
      onClick={onClick}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function Td({ className, children, align, ...rest }: ComponentProps<"td"> & { align?: "right" | "center" }) {
  return (
    <td
      className={cn(
        "h-12 px-3 align-middle first:pl-5 last:pr-5",
        align === "right" && "text-right tnum",
        align === "center" && "text-center",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  noun = "rows",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  noun?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-[12.5px] text-muted">
      <span className="tnum">
        {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} {noun}
      </span>
      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" onClick={() => onPage(page - 1)} disabled={page === 0} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="tnum px-1.5">
          {page + 1} / {pages}
        </span>
        <Button size="icon-sm" variant="ghost" onClick={() => onPage(page + 1)} disabled={page >= pages - 1} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
