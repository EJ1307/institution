"use client";

import { FileText, Paperclip, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/forms";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Button } from "@/components/ui/primitives";
import { addDays, fromIso, holidayName, isoDate, isSchoolDay, nextSchoolDay, today } from "@/lib/data/calendar";
import { studentsInClass } from "@/lib/data/people";
import { fmtWeekdayLong } from "@/lib/format";
import { getState, setState, type PostedHomework } from "@/lib/store";
import { keyParts } from "./model";

export function SetHomeworkDialog({ open, onClose, classes, subject, teacherName, onSaved }: { open: boolean; onClose: () => void; classes: string[]; subject: string; teacherName: string; onSaved: (h: PostedHomework) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Set homework" description="Students and parents see it in the app as soon as you save." size="md">
      {open && <Form classes={classes} subject={subject} teacherName={teacherName} onDone={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function Form({ classes, subject, teacherName, onDone, onSaved }: { classes: string[]; subject: string; teacherName: string; onDone: () => void; onSaved: (h: PostedHomework) => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [classKey, setClassKey] = useState(classes[0]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [due, setDue] = useState(isoDate(nextSchoolDay(today())));
  const [file, setFile] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const dueDate = due ? fromIso(due) : null;
  const errors = {
    title: !title.trim() ? "Give the homework a short title, e.g. Exercise 7.3, Q1–10" : null,
    detail: !detail.trim() ? "Add instructions so students know exactly what to do" : null,
    due: !dueDate ? "Pick a due date" : dueDate <= today() ? "The due date must be after today" : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (tried ? errors[k] : null);
  const offDay = dueDate && dueDate > today() && !isSchoolDay(dueDate) ? holidayName(dueDate) ?? "a weekend" : null;
  const count = studentsInClass(classKey).length;

  const submit = () => {
    setTried(true);
    if (!valid) return;
    const hw: PostedHomework = {
      id: `HWP-${classKey}-${Date.now().toString(36)}`,
      classKey,
      subject,
      title: title.trim(),
      detail: detail.trim(),
      assignedOn: isoDate(today()),
      dueOn: due,
      attachment: file ?? undefined,
      setBy: teacherName,
    };
    setState({ homework: [hw, ...getState().homework] });
    toast({ title: `Homework set for ${keyParts(classKey).label}`, body: `${count} students and their parents can see it now. Due ${fmtWeekdayLong(fromIso(due))}.` });
    onSaved(hw);
    onDone();
  };

  return (
    <form
      noValidate
      className="-mx-5 -my-4 flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Class" htmlFor="hw-class" hint={`${count} students`}>
            <Select id="hw-class" value={classKey} onChange={(e) => setClassKey(e.target.value)} className="w-full">
              {classes.map((k) => (
                <option key={k} value={k}>
                  {keyParts(k).label}
                  {k === classes[0] ? " (your class)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" htmlFor="hw-subject" hint="Your subject">
            <Select id="hw-subject" value={subject} disabled className="w-full">
              <option>{subject}</option>
            </Select>
          </Field>
        </div>
        <Field label="Title" htmlFor="hw-title" error={show("title")}>
          <Input id="hw-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Comparing Quantities: Exercise 7.3, Q1–10" autoFocus />
        </Field>
        <Field label="Instructions" htmlFor="hw-detail" error={show("detail")} hint="Shown to students and parents exactly as written.">
          <Textarea id="hw-detail" rows={4} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Show all working. Questions 8–10 are optional." />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due on" htmlFor="hw-due" error={show("due")} hint={offDay ? `That's ${offDay}. Students will hand it in the next school day.` : dueDate ? fmtWeekdayLong(dueDate) : undefined}>
            <Input id="hw-due" type="date" value={due} min={isoDate(addDays(today(), 1))} max={isoDate(addDays(today(), 45))} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-2">Attachment</span>
            <input ref={fileRef} type="file" accept=".pdf,image/*,.doc,.docx" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
            {file ? (
              <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 pr-1 pl-3 text-[13px]">
                <FileText className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate">{file}</span>
                <button type="button" onClick={() => setFile(null)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink" aria-label="Remove attachment">
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-9 items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong text-[13px] text-ink-2 transition-colors hover:border-brand hover:text-brand"
              >
                <Paperclip className="size-4" /> Worksheet or photo
              </button>
            )}
            <p className="text-[12px] text-muted">PDF or image, up to 10 MB</p>
          </div>
        </div>
      </div>
      <footer className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-muted">Parents get an app notification at 4:00 pm with the day&apos;s homework.</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button variant="primary" type="submit" className="flex-1 sm:flex-none">
            <Send /> Set homework
          </Button>
        </div>
      </footer>
    </form>
  );
}
