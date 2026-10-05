"use client";

import { useCallback, useEffect, useState } from "react";
import { BRAND_KEY, DEFAULT_BRAND, cssVarsFor, presetById, type BrandConfig } from "./brand";
import { PERSONA_ADMIN_ID, PERSONA_PARENT, PERSONA_TEACHER_ID, studentById, staffById } from "./data/people";
import { setState, useAppState, type Role } from "./store";

export const PERSONAS: Record<Role, { userId: string; name: string; title: string; login: string }> = {
  admin: { userId: PERSONA_ADMIN_ID, name: "Dr. Meenakshi Rao", title: "Principal", login: "principal@amaltas.edu.in" },
  teacher: { userId: PERSONA_TEACHER_ID, name: "Ms. Kavya Iyer", title: "TGT Mathematics · Class teacher, VIII-B", login: "kavya.iyer@amaltas.edu.in" },
  parent: { userId: PERSONA_PARENT.id, name: "Rohan Mehta", title: "Parent of Aanya (VII-A) & Vihaan (II-C)", login: "98100 24071" },
};

export function signIn(role: Role) {
  const p = PERSONAS[role];
  setState({ session: { role, userId: p.userId, name: p.name } });
}

export function signOut() {
  setState({ session: null });
}

export function useSession() {
  return useAppState((s) => s.session);
}

export function useRole(): Role {
  return useAppState((s) => s.session?.role ?? "admin");
}

/** The logged-in teacher's staff record (teacher role). */
export function useTeacher() {
  return staffById(PERSONA_TEACHER_ID)!;
}

/** Parent view: the selected child, plus the list to switch between. */
export function useChild() {
  const childId = useAppState((s) => s.childId);
  const child = studentById(childId) ?? studentById(PERSONA_PARENT.children[0])!;
  const children = PERSONA_PARENT.children.map((id) => studentById(id)!);
  const setChild = useCallback((id: string) => setState({ childId: id }), []);
  return { child, children, setChild };
}

// ——— Brand (white-label) ————————————————————————————————————————————

function readBrand(): BrandConfig {
  try {
    const raw = localStorage.getItem(BRAND_KEY);
    if (raw) return { ...DEFAULT_BRAND, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_BRAND;
}

const brandListeners = new Set<(b: BrandConfig) => void>();

export function applyBrand(b: BrandConfig) {
  const vars = cssVarsFor(presetById(b.presetId));
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", presetById(b.presetId).deep);
}

export function saveBrand(b: BrandConfig) {
  try {
    localStorage.setItem(BRAND_KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
  applyBrand(b);
  brandListeners.forEach((l) => l(b));
}

export function useBrand(): BrandConfig {
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  useEffect(() => {
    setBrand(readBrand());
    const l = (b: BrandConfig) => setBrand(b);
    brandListeners.add(l);
    return () => {
      brandListeners.delete(l);
    };
  }, []);
  return brand;
}
