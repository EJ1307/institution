# Amaltas Portal — school operating system (demo)

A complete, clickable demo of a school ERP for Indian K–12 schools: one portal for **leadership**, **teachers** and **parents** covering attendance, fees, exams and report cards, admissions, timetables, transport, notices, homework and the school calendar.

It is built to be pitched as a white-label "institutional build": the demo school is the fictional **Amaltas International School, Gurugram**, and the whole portal can be re-branded for a prospect in seconds from **Settings → Branding**.

> Everything runs in the browser on generated data — no backend, no database, no real student information. Demo actions (marking a register, paying a fee, posting a notice…) are saved in the browser's local storage so they survive reloads and show up across roles.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build && npm start   # production build
npm run typecheck
```

### Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel: **Add New → Project → Import** the repository.
3. Framework preset is detected as **Next.js**. No environment variables are needed. Click **Deploy**.

## Demo logins

On the sign-in page pick a role — credentials are pre-filled (any password works).

| Role | Persona | What they see |
| --- | --- | --- |
| Leadership | Dr. Meenakshi Rao, Principal | Whole-school dashboard, students, staff & leave, admissions pipeline, attendance, exams, timetable, fees, transport, notices, calendar, settings |
| Teacher | Ms. Kavya Iyer, TGT Mathematics, class teacher of VIII-B | Her day, mark attendance, gradebook, homework, her students and timetable |
| Parent | Rohan Mehta, parent of Aanya (VII-A) and Vihaan (II-C) | Child switcher, attendance calendar, report card, fees & online payment, live school bus, homework, notices (works like a mobile app on phones) |

Parents sign in with a mobile number and a one-time code (the demo code `246810` fills itself in).

Switch roles at any time from the **Demo · viewing as** menu in the top bar, and use **Reset demo data** there before a fresh pitch. Press **⌘K / Ctrl K** anywhere to search students, staff and pages.

## A five-minute pitch walkthrough

1. **Sign in as Leadership.** The dashboard opens on today: attendance against target, fee collection, staff present, admissions. Point out *Needs your attention* — VIII-B's register isn't marked, overdue fees, board-exam students under CBSE's 75% attendance rule.
2. **Switch to Teacher.** Kavya's day is laid out period by period. Tap **Mark attendance**, mark a couple of absences, submit.
3. **Switch back to Leadership.** VIII-B is now filled in on the class-wise heatmap and the attendance figures have moved.
4. **Switch to Parent** (try it on a phone). Aanya's attendance, results and bus are on one screen. Pay the open fee instalment with UPI — a receipt is issued instantly.
5. **Back to Leadership → Fees.** The payment is in the transactions list and the collection numbers have updated.
6. **Settings → Branding.** Pick the prospect's colours and type their school's name — the entire portal re-skins live. "This is your portal."

## What's inside

```
src/
  app/
    login/                 sign-in (staff email + password, parent mobile + OTP)
    (app)/                 everything behind sign-in, wrapped in the app shell
      dashboard/           role-aware home (principal / teacher / parent)
      students/ staff/ admissions/ attendance/ academics/ timetable/
      fees/ transport/ notices/ calendar/ homework/ settings/
  components/
    ui/                    design system: buttons, cards, forms, tables, dialogs, toasts
    charts/                hand-built SVG charts (line, column, heatmap, bar list, funnel…)
    shell/                 sidebar, top bar, ⌘K command palette, mobile navigation
    dashboards/            the three role dashboards
  lib/
    data/                  deterministic demo data: ~1,550 students across Nursery–XII,
                           ~110 staff, attendance, fees, exams, admissions, timetables,
                           bus routes, notices, events, homework
    store.ts               persistent demo store (local storage)
    brand.ts               white-label settings: school name, motto, colour presets
```

### Data that feels real

- **Dates are live.** The academic year (April–March), school days, holidays, exam windows, fee due dates and events are all computed from today's date, so the demo never looks stale.
- **Deterministic.** Every student, mark and payment comes from fixed seeds — the same school appears on every device, every time.
- **Indian school specifics.** CBSE grading (A1–E), quarterly fee instalments with concessions (sibling, merit, staff ward, RTE), lakh/crore formatting, houses named after mountain ranges, Classes XI–XII streams, the 75% board-exam attendance rule, PTMs, AQI advisories, Gurugram bus routes.

To sanity-check the generated data from the command line:

```bash
npx tsx scripts/inspect-data.ts
```

## Re-branding for a prospect

- **In the app:** Settings → Branding (saved in the browser — perfect for a live demo).
- **In code:** edit `DEFAULT_BRAND` and `PRESETS` in `src/lib/brand.ts` (school name, short name, city, motto, product name, colours). The crest is `src/components/shell/Crest.tsx` and the favicon is `src/app/icon.svg`.

## Design notes

- Type: Instrument Sans for the interface, Source Serif 4 for page titles, Tiro Devanagari Hindi for the motto. All self-hosted via Fontsource — no external font requests.
- Colour: a warm paper background, white cards with hairline borders, and the school's colour used sparingly for actions and navigation.
- Charts follow a strict data-visualisation standard: a colour-blind-checked categorical palette in fixed order, thin marks, hairline grids, legends for every multi-series chart, values printed selectively, hover/keyboard tooltips, and no dual axes, pies or donuts.

## Going from demo to production

The UI reads everything through `src/lib/data/*` and writes demo actions through `src/lib/store.ts`. To make it real, replace those modules with API calls (e.g. Next.js route handlers or a separate backend with PostgreSQL), add real authentication (staff SSO, parent OTP via an SMS provider), connect a payment gateway for UPI/cards/net banking, and an SMS/WhatsApp provider for notifications.
