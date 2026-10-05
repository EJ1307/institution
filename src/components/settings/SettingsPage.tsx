"use client";

import { Bell, Building2, Database, Lock, Palette, PlugZap, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/forms";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Badge, ButtonLink, Card, cn } from "@/components/ui/primitives";
import { academicYear } from "@/lib/data/calendar";
import { students } from "@/lib/data/people";
import { number } from "@/lib/format";
import { useBrand, useRole } from "@/lib/session";
import { BrandingSection } from "./BrandingSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { NotificationsSection } from "./NotificationsSection";
import { ProfileSection } from "./ProfileSection";
import { RolesSection } from "./RolesSection";
import { SecuritySection } from "./SecuritySection";

type Section = "profile" | "branding" | "roles" | "notifications" | "integrations" | "security";

const SECTIONS: { id: Section; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "profile", label: "School profile", hint: "Name, address, affiliation", icon: Building2 },
  { id: "branding", label: "Branding", hint: "Colours, crest, motto", icon: Palette },
  { id: "roles", label: "Users & roles", hint: "Who can see and do what", icon: UsersRound },
  { id: "notifications", label: "Notifications", hint: "SMS, WhatsApp, email, push", icon: Bell },
  { id: "integrations", label: "Integrations", hint: "Payments, devices, exports", icon: PlugZap },
  { id: "security", label: "Data & security", hint: "Residency, backups, audit log", icon: ShieldCheck },
];

export function SettingsPage() {
  const role = useRole();
  const brand = useBrand();
  const params = useSearchParams();
  const ay = academicYear();
  const requested = params.get("tab") as Section | null;
  const section: Section = requested && SECTIONS.some((s) => s.id === requested) ? requested : "profile";
  const go = (s: Section) => window.history.replaceState(null, "", s === "profile" ? "/settings" : `/settings?tab=${s}`);

  if (role !== "admin") {
    return (
      <>
        <PageHeader title="Settings" />
        <Card>
          <EmptyState
            icon={<Lock />}
            title="Settings are managed by the school office"
            body="Only the principal and administrators can change school settings. Your own notification preferences are in the app's profile menu."
            action={
              <ButtonLink href="/dashboard" size="sm">
                Back to dashboard
              </ButtonLink>
            }
            className="py-20"
          />
        </Card>
      </>
    );
  }

  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <>
      <PageHeader
        title="Settings"
        description={`How ${brand.school} runs on ${brand.product}. Changes apply to the staff portal and the parent app as soon as you save.`}
        actions={
          <div className="flex flex-col items-start gap-1 text-[12px] text-muted sm:items-end">
            <Badge tone="outline">
              <span className="size-1.5 rounded-full bg-good" /> Institution plan
            </Badge>
            <span className="tnum">
              {number(students().length)} students · renews 31 Mar {ay.startYear + 1}
            </span>
          </div>
        }
      />

      <Tabs value={section} onChange={go} tabs={SECTIONS.map((s) => ({ value: s.id, label: s.label }))} className="mb-5 lg:hidden" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:gap-8">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-[84px] flex flex-col gap-0.5">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = s.id === section;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => go(s.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      active ? "bg-surface shadow-[0_0_0_1px_var(--line),var(--shadow-card)]" : "hover:bg-ink/[0.04]",
                    )}
                  >
                    <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-brand" : "text-muted")} strokeWidth={1.9} />
                    <span className="min-w-0">
                      <span className={cn("block text-[13px] font-medium", active ? "text-ink" : "text-ink-2")}>{s.label}</span>
                      <span className="block truncate text-[12px] text-muted">{s.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            <li className="mt-4 flex items-start gap-2.5 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-[12px] leading-snug text-muted">
              <Database className="mt-0.5 size-3.5 shrink-0" />
              <span>Data stored in India. Every change here is recorded in the audit log.</span>
            </li>
          </ul>
        </nav>

        <div className="min-w-0" aria-label={current.label}>
          {section === "profile" && <ProfileSection />}
          {section === "branding" && <BrandingSection />}
          {section === "roles" && <RolesSection />}
          {section === "notifications" && <NotificationsSection />}
          {section === "integrations" && <IntegrationsSection />}
          {section === "security" && <SecuritySection />}
        </div>
      </div>
    </>
  );
}
