"use client";

import { FileCheck2, FileClock, FileImage, FileText, FileX2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { KeyValue } from "@/components/ui/layout";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, cn, Meter } from "@/components/ui/primitives";
import { today } from "@/lib/data/calendar";
import { staff, type Student } from "@/lib/data/people";
import { fmtDate } from "@/lib/format";
import { documentsFor, type DocStatus, type StudentDoc } from "./profileData";

const STATUS: Record<DocStatus, { label: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  verified: { label: "Verified", tone: "good" },
  pending: { label: "Pending verification", tone: "warn" },
  missing: { label: "Missing", tone: "bad" },
  na: { label: "Not applicable", tone: "neutral" },
};

function DocIcon({ doc }: { doc: StudentDoc }) {
  const Icon = doc.status === "missing" ? FileX2 : doc.status === "pending" ? FileClock : doc.file?.endsWith(".jpg") ? FileImage : doc.status === "verified" ? FileCheck2 : FileText;
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-[18px]",
        doc.status === "missing" ? "bg-bad-soft text-bad" : doc.status === "pending" ? "bg-warn-soft text-warn" : doc.status === "na" ? "bg-ink/[0.04] text-faint" : "bg-brand-soft text-brand",
      )}
    >
      <Icon strokeWidth={1.8} />
    </span>
  );
}

export function ProfileDocuments({ student: s, canEdit }: { student: Student; canEdit: boolean }) {
  const toast = useToast();
  const base = useMemo(() => documentsFor(s, today()), [s]);
  const [overrides, setOverrides] = useState<Record<string, Partial<StudentDoc>>>({});
  const [viewing, setViewing] = useState<StudentDoc | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const frontOffice = staff().find((x) => x.designation === "Front office executive");
  const verifier = frontOffice ? `${frontOffice.title} ${frontOffice.name}` : "Front office";

  const docs = base.map((d) => ({ ...d, ...overrides[d.id] }));
  const required = docs.filter((d) => d.status !== "na");
  const verified = required.filter((d) => d.status === "verified").length;
  const pending = required.filter((d) => d.status === "pending").length;
  const missing = required.filter((d) => d.status === "missing").length;

  const pick = (id: string) => {
    setUploadFor(id);
    fileInput.current?.click();
  };

  const onFile = (file: File | undefined) => {
    if (!file || !uploadFor) return;
    const doc = docs.find((d) => d.id === uploadFor)!;
    setOverrides((o) => ({
      ...o,
      [uploadFor]: { status: "pending", file: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB`, uploaded: new Date(), note: "Uploaded just now — the front office verifies within 2 working days" },
    }));
    setViewing(null);
    toast({ title: `${doc.name} uploaded`, body: `${file.name} is waiting for verification by the front office.` });
    setUploadFor(null);
  };

  const verify = (doc: StudentDoc) => {
    setOverrides((o) => ({ ...o, [doc.id]: { status: "verified", note: undefined } }));
    toast({ title: `${doc.name} verified`, body: `Marked as checked against the original. ${s.firstName}'s file is ${verified + 1} of ${required.length} complete.` });
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Documents on file" description={`Admission and compliance records for ${s.name}`} />
        <ul className="border-t border-line">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-col gap-3 border-b border-line px-5 py-3.5 last:border-b-0 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <DocIcon doc={d} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-[13.5px] font-medium", d.status === "na" ? "text-muted" : "text-ink")}>{d.name}</span>
                    <Badge tone={STATUS[d.status].tone} dot={d.status !== "na"}>
                      {STATUS[d.status].label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted">
                    {d.detail}
                    {d.file && (
                      <span className="hidden md:inline">
                        {" "}
                        · {d.file} · {d.size}
                      </span>
                    )}
                  </p>
                  {d.note && <p className={cn("mt-1 text-[12px]", d.status === "missing" ? "text-bad" : "text-warn")}>{d.note}</p>}
                </div>
              </div>
              <span className="tnum hidden w-[88px] shrink-0 text-right text-[12px] text-muted lg:inline">{d.uploaded ? fmtDate(d.uploaded) : ""}</span>
              <div className="flex shrink-0 items-center gap-1.5 pl-12 sm:w-[196px] sm:justify-end sm:pl-0">
                {d.status === "pending" && canEdit && (
                  <Button size="sm" variant="secondary" onClick={() => verify(d)}>
                    Mark verified
                  </Button>
                )}
                {d.status === "missing" && canEdit && (
                  <Button size="sm" variant="secondary" onClick={() => pick(d.id)}>
                    <Upload /> Upload
                  </Button>
                )}
                {d.file && (
                  <Button size="sm" variant="ghost" onClick={() => setViewing(d)}>
                    Details
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ""))} aria-hidden tabIndex={-1} />
      </Card>

      <Card className="self-start">
        <CardHeader title="File completeness" description="Required for the CBSE registration and UDISE+ return" />
        <div className="px-5 pb-5">
          <div className="flex items-baseline gap-2">
            <span className="tnum text-[28px] leading-none font-semibold tracking-[-0.02em] text-ink">
              {verified}
              <span className="text-[16px] font-medium text-muted">/{required.length}</span>
            </span>
            <span className="text-[12.5px] text-muted">verified</span>
          </div>
          <Meter value={verified / (required.length || 1)} tone={missing ? "warn" : "good"} className="mt-3" label="Documents verified" />
          <dl className="mt-4 divide-y divide-line">
            <KeyValue k="Pending verification" v={<span className="tnum">{pending}</span>} />
            <KeyValue k="Missing" v={<span className={cn("tnum", missing && "font-medium text-bad")}>{missing}</span>} />
            <KeyValue k="Not applicable" v={<span className="tnum">{docs.length - required.length}</span>} />
          </dl>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Originals are checked at the front office and returned the same day. Scans are stored encrypted, in India, and visible only to the admissions team and the principal.
          </p>
        </div>
      </Card>

      <Dialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? ""}
        description={viewing?.file ?? ""}
        size="sm"
        footer={
          <>
            {canEdit && viewing && (
              <Button variant="ghost" onClick={() => pick(viewing.id)}>
                <Upload /> Replace file
              </Button>
            )}
            <Button variant="primary" onClick={() => setViewing(null)}>
              Done
            </Button>
          </>
        }
      >
        {viewing && (
          <dl className="divide-y divide-line">
            <KeyValue k="Status" v={<Badge tone={STATUS[viewing.status].tone}>{STATUS[viewing.status].label}</Badge>} />
            <KeyValue k="Details" v={viewing.detail} />
            <KeyValue k="File" v={`${viewing.file} · ${viewing.size}`} />
            {viewing.uploaded && <KeyValue k="Uploaded" v={fmtDate(viewing.uploaded)} />}
            {viewing.status === "verified" && <KeyValue k="Verified by" v={verifier} />}
            <KeyValue k="Access" v="Admissions team, principal" />
          </dl>
        )}
      </Dialog>
    </div>
  );
}
