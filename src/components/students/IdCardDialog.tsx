"use client";

import { Printer } from "lucide-react";
import { Crest } from "@/components/shell/Crest";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Button } from "@/components/ui/primitives";
import { academicYear } from "@/lib/data/calendar";
import type { Student } from "@/lib/data/people";
import { GRADE_BY_ID } from "@/lib/data/school";
import { ROUTE_BY_ID } from "@/lib/data/transport";
import { fmtDate, initials } from "@/lib/format";
import { hashInt } from "@/lib/rng";
import { useBrand } from "@/lib/session";
import { houseColor } from "./shared";

/** Code-128-looking bars derived from the admission number (decorative, stable). */
function Barcode({ value, width = 132, height = 26 }: { value: string; width?: number; height?: number }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  let i = 0;
  while (x < width - 4) {
    const h = hashInt(value, i++);
    const w = 1 + (h % 3);
    const gap = 1 + ((h >>> 3) % 2);
    if (x + w > width) break;
    bars.push({ x, w });
    x += w + gap;
  }
  return (
    <svg width={width} height={height} aria-hidden className="block">
      {bars.map((b, k) => (
        <rect key={k} x={b.x} y={0} width={b.w} height={height} fill="#17191C" />
      ))}
    </svg>
  );
}

export function IdCardDialog({ student: s, open, onClose, medical }: { student: Student; open: boolean; onClose: () => void; medical: string }) {
  const brand = useBrand();
  const toast = useToast();
  const ay = academicYear();
  const g = GRADE_BY_ID[s.grade];
  const route = s.routeId ? ROUTE_BY_ID[s.routeId] : null;
  const dob = new Date(s.dob);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Student ID card"
      description={`CR80 card, 54 × 86 mm · valid for AY ${ay.label}`}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              toast({ title: "Added to the print batch", body: `${s.firstName}'s card will go out with this week's batch from the front office.`, tone: "info" });
              onClose();
            }}
          >
            Add to print batch
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer /> Print card
          </Button>
        </>
      }
    >
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 16mm; }
          body * { visibility: hidden !important; }
          dialog::backdrop { background: transparent !important; }
          dialog { box-shadow: none !important; border: 0 !important; }
          #id-card-print, #id-card-print * { visibility: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #id-card-print { position: fixed; left: 0; top: 0; }
        }
      `}</style>
      <div id="id-card-print" className="flex flex-col items-center justify-center gap-6 rounded-xl bg-paper px-4 py-6 sm:flex-row sm:items-start print:bg-white">
        {/* Front */}
        <figure className="flex flex-col items-center gap-2">
          <div className="relative flex h-[400px] w-[252px] flex-col overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_8px_24px_-10px_rgb(23_25_28/0.28),0_1px_2px_rgb(23_25_28/0.08)]">
            <div className="relative bg-brand-deep px-4 pt-3.5 pb-10 text-white">
              <div className="flex items-center gap-2.5">
                <Crest size={30} />
                <div className="min-w-0">
                  <div className="title-serif truncate text-[13px] leading-tight font-semibold">{brand.school}</div>
                  <div className="truncate text-[9px] tracking-[0.02em] text-white/60">{brand.city}</div>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-[3px] bg-accent" />
            </div>
            <div className="relative z-10 -mt-8 flex justify-center">
              <div className="rounded-[10px] bg-white p-[3px] shadow-[0_1px_3px_rgb(0_0_0/0.15)]">
                <svg width={88} height={104} viewBox="0 0 88 104" className="block rounded-[8px]" role="img" aria-label={`Photograph of ${s.name}`}>
                  <rect width="88" height="104" fill="#E9ECE7" />
                  <circle cx="44" cy="42" r="19" fill="#C8CEC6" />
                  <path d="M10 104 C 12 78, 28 68, 44 68 C 60 68, 76 78, 78 104 Z" fill="#C8CEC6" />
                  <text x="44" y="47" textAnchor="middle" fontSize="13" fontWeight="600" fill="#6F776E" letterSpacing="0.04em">
                    {initials(s.name)}
                  </text>
                </svg>
              </div>
            </div>
            <div className="mt-2.5 px-4 text-center">
              <div className="title-serif text-[17px] leading-tight font-semibold text-[#17191C]">{s.name}</div>
              <div className="mt-0.5 text-[11px] font-medium text-[#464A50]">
                {g.label} {s.section} · Roll {s.roll}
              </div>
            </div>
            <dl className="mx-4 mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-[3px] border-t border-[#E7E5DE] pt-2.5 text-[10px] leading-[14px]">
              <dt className="text-[#777B81]">Adm. no.</dt>
              <dd className="tnum font-medium text-[#17191C]">{s.admissionNo}</dd>
              <dt className="text-[#777B81]">Date of birth</dt>
              <dd className="tnum font-medium text-[#17191C]">{fmtDate(dob)}</dd>
              <dt className="text-[#777B81]">Blood group</dt>
              <dd className="font-medium text-[#17191C]">{s.bloodGroup}</dd>
              <dt className="text-[#777B81]">House</dt>
              <dd className="flex items-center gap-1 font-medium text-[#17191C]">
                <span className="size-1.5 rounded-full" style={{ background: houseColor(s.house) }} />
                {s.house}
              </dd>
              <dt className="text-[#777B81]">Transport</dt>
              <dd className="font-medium text-[#17191C]">{route ? `Bus ${route.id} · ${route.name}` : "Own"}</dd>
            </dl>
            <div className="mt-auto flex items-end justify-between px-4 pb-3">
              <div>
                <Barcode value={s.admissionNo} width={110} height={22} />
                <div className="tnum mt-0.5 text-[8px] tracking-[0.12em] text-[#777B81]">{s.admissionNo.replace(/\//g, "")}</div>
              </div>
              <div className="text-right">
                <div className="title-serif text-[13px] leading-none text-[#17191C] italic">M. Rao</div>
                <div className="mt-1 text-[8px] text-[#777B81]">Principal</div>
              </div>
            </div>
            <div className="h-[6px]" style={{ background: houseColor(s.house) }} />
          </div>
          <figcaption className="text-[11.5px] text-muted">Front</figcaption>
        </figure>

        {/* Back */}
        <figure className="flex flex-col items-center gap-2">
          <div className="flex h-[400px] w-[252px] flex-col overflow-hidden rounded-[14px] border border-line bg-white px-4 py-4 text-[10px] leading-[14px] text-[#464A50] shadow-[0_8px_24px_-10px_rgb(23_25_28/0.28),0_1px_2px_rgb(23_25_28/0.08)]">
            <div className="text-[8.5px] font-semibold tracking-[0.12em] text-[#777B81] uppercase">In an emergency, call</div>
            <ul className="mt-1.5 space-y-1">
              {s.guardians.map((p) => (
                <li key={p.name} className="flex justify-between gap-2">
                  <span className="truncate text-[#17191C]">
                    {p.name} <span className="text-[#777B81]">({p.relation.toLowerCase()})</span>
                  </span>
                  <span className="tnum shrink-0 font-medium text-[#17191C]">{p.phone.replace("+91 ", "")}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-[8.5px] font-semibold tracking-[0.12em] text-[#777B81] uppercase">Medical</div>
            <p className="mt-1 text-[#17191C]">
              Blood group {s.bloodGroup} · {medical}
            </p>
            {route && (
              <>
                <div className="mt-3 text-[8.5px] font-semibold tracking-[0.12em] text-[#777B81] uppercase">School bus</div>
                <p className="mt-1 text-[#17191C]">
                  Route {route.id} · {route.name}
                </p>
                <p className="tnum text-[#777B81]">
                  {route.bus} · attendant {route.attendant}
                </p>
                <p className="text-[#777B81]">Transport desk · transport@laburnumacademy.org</p>
              </>
            )}
            <div className="mt-auto rounded-lg bg-[#F6F5F1] px-3 py-2.5">
              <div className="text-[8.5px] font-semibold tracking-[0.12em] text-[#777B81] uppercase">If found, please return to</div>
              <p className="mt-1 font-medium text-[#17191C]">{brand.school}</p>
              <p>{brand.city}</p>
              <p className="tnum">office@laburnumacademy.org</p>
            </div>
            <p className="mt-2.5 text-[8.5px] leading-[12px] text-[#777B81]">
              Carry this card every day; it is scanned at the gate and on the school bus. Valid till 31 March {ay.startYear + 1}.
            </p>
          </div>
          <figcaption className="text-[11.5px] text-muted">Back</figcaption>
        </figure>
      </div>
    </Dialog>
  );
}
