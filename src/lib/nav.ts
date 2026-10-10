import {
  BarChart3, Bell, BookOpenCheck, Bus, CalendarDays, CalendarRange, ClipboardCheck, GraduationCap,
  Home, DollarSign, LayoutDashboard, NotebookPen, Settings, UserPlus, Users, UsersRound, type LucideIcon,
} from "lucide-react";
import type { Role } from "./store";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string | null; items: NavItem[] };

export const NAV: Record<Role, NavGroup[]> = {
  admin: [
    { label: null, items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "People",
      items: [
        { href: "/students", label: "Students", icon: GraduationCap },
        { href: "/staff", label: "Staff", icon: UsersRound },
        { href: "/admissions", label: "Admissions", icon: UserPlus },
      ],
    },
    {
      label: "Academics",
      items: [
        { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
        { href: "/academics", label: "Exams & results", icon: BarChart3 },
        { href: "/timetable", label: "Timetable", icon: CalendarRange },
      ],
    },
    {
      label: "Operations",
      items: [
        { href: "/fees", label: "Fees", icon: DollarSign },
        { href: "/transport", label: "Transport", icon: Bus },
        { href: "/notices", label: "Notices", icon: Bell },
        { href: "/calendar", label: "Calendar", icon: CalendarDays },
      ],
    },
  ],
  teacher: [
    { label: null, items: [{ href: "/dashboard", label: "My day", icon: Home }] },
    {
      label: "My classes",
      items: [
        { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
        { href: "/academics", label: "Gradebook", icon: BarChart3 },
        { href: "/homework", label: "Homework", icon: NotebookPen },
        { href: "/students", label: "Students", icon: Users },
        { href: "/timetable", label: "Timetable", icon: CalendarRange },
      ],
    },
    {
      label: "School",
      items: [
        { href: "/notices", label: "Notices", icon: Bell },
        { href: "/calendar", label: "Calendar", icon: CalendarDays },
      ],
    },
  ],
  parent: [
    { label: null, items: [{ href: "/dashboard", label: "Home", icon: Home }] },
    {
      label: "My child",
      items: [
        { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
        { href: "/academics", label: "Report card", icon: BookOpenCheck },
        { href: "/homework", label: "Homework", icon: NotebookPen },
        { href: "/fees", label: "Fees & payments", icon: DollarSign },
        { href: "/transport", label: "School bus", icon: Bus },
      ],
    },
    {
      label: "School",
      items: [
        { href: "/notices", label: "Notices", icon: Bell },
        { href: "/calendar", label: "Calendar", icon: CalendarDays },
      ],
    },
  ],
};

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings };

/** Parent bottom bar on phones */
export const PARENT_TABS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/fees", label: "Fees", icon: DollarSign },
  { href: "/transport", label: "Bus", icon: Bus },
  { href: "/notices", label: "Notices", icon: Bell },
];

export function allowed(role: Role, path: string) {
  const items = [...NAV[role].flatMap((g) => g.items), SETTINGS_ITEM];
  return items.some((i) => path === i.href || path.startsWith(i.href + "/"));
}
