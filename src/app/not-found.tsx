import Link from "next/link";
import { Crest } from "@/components/shell/Crest";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6">
      <div className="max-w-sm text-center">
        <Crest size={48} className="mx-auto" />
        <p className="eyebrow mt-6">Error 404</p>
        <h1 className="title-serif mt-2 text-[28px] leading-tight font-semibold">This page isn&apos;t on the timetable</h1>
        <p className="mt-2 text-[14px] text-muted">The link may be old, or the page may have moved. Head back to your dashboard and pick up from there.</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-brand px-4 text-[13.5px] font-medium text-white hover:brightness-110"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
