# vacti — Design System & UI Redesign Plan

> The v0 UI was functional-only (plain forms, top links, no design language). This plan defines a
> deliberate, modern, security-grade design system and a page-by-page redesign. Goal: feels like a
> premium product (Linear / Vercel / Tailwind-UI calibre) — calm, dense-but-breathable, dark-first,
> trustworthy.

## 1. Design principles

1. **Clarity over decoration.** Recon data is the hero. Chrome recedes; content leads.
2. **Dense, but breathing.** Security tools show a lot — use rhythm, grouping, and whitespace so it
   never feels cramped (think Linear tables, not phpMyAdmin).
3. **Dark-first, light supported.** Default dark theme tuned for long sessions; light mode first-class.
4. **Calm, professional, trustworthy.** Muted neutrals + one confident accent. Color is reserved for
   meaning (severity, risk, status) — not flourish.
5. **Always responsive to state.** Every surface has loading (skeleton), empty, error, and live states.
6. **Motion with restraint.** Subtle, fast (120–200ms), purposeful; respects `prefers-reduced-motion`.
7. **Keyboard-first power use.** Command palette (⌘K), focus rings, full keyboard nav. WCAG AA.

## 2. Foundations (tokens)

### Color — neutral scale

Base on a cool neutral (zinc). Dark theme example (CSS variables, HSL):

```
--background: 240 10% 4%      /* app bg (near-black, slight blue) */
--surface:    240 8% 7%       /* cards / panels */
--surface-2:  240 7% 10%      /* raised / hover */
--border:     240 6% 16%
--muted-fg:   240 5% 65%
--fg:         0 0% 98%
--accent:     217 91% 60%     /* electric blue — primary actions/links (see direction options) */
--accent-fg:  0 0% 100%
--ring:       217 91% 60%
```

Light theme mirrors with inverted lightness. All pairs verified for **WCAG AA** contrast.

### Color — semantic (severity & risk)

Consistent everywhere (tables, charts, badges, reports) — single source in `@vacti/ui`:

| Token              | Use           | Hue                 |
| ------------------ | ------------- | ------------------- |
| `sev-critical`     | Critical vuln | red 0 84% 60%       |
| `sev-high`         | High          | orange 25 95% 58%   |
| `sev-medium`       | Medium        | amber 38 92% 55%    |
| `sev-low`          | Low           | yellow 48 90% 55%   |
| `sev-info`         | Info          | sky 200 80% 60%     |
| `risk-green`       | 0–30          | emerald 152 60% 45% |
| `risk-yellow`      | 31–70         | amber 38 92% 55%    |
| `risk-red`         | 71–100        | red 0 84% 60%       |
| `status-running`   | scan running  | accent + pulse      |
| `status-completed` | done          | emerald             |
| `status-failed`    | failed        | red                 |
| `status-queued`    | queued        | zinc                |
| `status-cancelled` | cancelled     | zinc-dim            |

### Typography

- Font: **Geist Sans** (UI) + **Geist Mono** (code/IDs/payloads). Fallback Inter / ui-monospace.
- Scale (rem): 0.75 / 0.8125 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 1.875 / 2.25.
- Body 14px; tables 13px; numerals **tabular** for counts/ports.

### Spacing, radius, elevation

- Spacing scale: 4px base (2,4,6,8,12,16,20,24,32,48).
- Radius: sm 6px, md 8px, lg 12px, xl 16px, full. Cards = lg; inputs/buttons = md.
- Elevation: borders + subtle shadows only (no heavy drop shadows in dark). Hover lifts `surface-2`.

### Iconography & motion

- **lucide-react** icons (1.5px stroke). Consistent 16/18/20 sizes.
- Motion via **framer-motion**: fade/slide 150ms ease-out; list stagger ≤ 30ms; live "pulse" dot for
  running scans; skeleton shimmer. All gated by reduced-motion.

## 3. Component library (shadcn/ui + Radix)

Install shadcn/ui; wrap in `@vacti/ui` with our tokens. Inventory:

- Primitives: Button (variants: primary/secondary/ghost/destructive/outline), Input, Textarea,
  Select, Checkbox, Switch, Label, Tooltip, Dropdown menu, Dialog, Sheet/Drawer, Tabs, Badge,
  Card, Separator, Avatar, Skeleton, Progress, ScrollArea, Popover, Toast (**sonner**).
- Composite (vacti): `StatCard`, `SeverityBadge`, `StatusPill` (with live pulse), `RiskGauge`,
  `DataTable` (TanStack Table + shadcn — sortable/filterable/paginated server-side), `EmptyState`,
  `PageHeader`, `Timeline` (scan activity stepper), `CodeBlock` (req/resp, copy), `CommandPalette`
  (**cmdk**, ⌘K), `ThemeToggle`, `ProjectSwitcher`.
- Charts (**Recharts**, themed): `SeverityDonut`, `TrendArea` (7-day), `RiskGauge`, mini sparklines.

## 4. App shell (new layout)

Replace the top link-bar with a real product shell:

```
┌───────────────────────────────────────────────────────────┐
│ ▟ vacti   [Project ▾]        ⌘K Search…        ◑  ⚙  (AV) │  topbar (56px)
├──────────┬────────────────────────────────────────────────┤
│ ◈ Dash   │                                                 │
│ ◈ Targets│   <Page content, max-w 1200, px-8>             │
│ ◈ Scans  │                                                 │
│ ◈ Threat │                                                 │
│ ◈ Reports│                                                 │
│ ◈ API    │                                                 │
│ ─────────│                                                 │
│ ⚙ Settings                                                 │
└──────────┴────────────────────────────────────────────────┘
  sidebar (collapsible, 240px → 64px icon-rail)
```

- Left **sidebar**: icon + label nav, active state (accent bar + tint), collapsible to icon rail,
  RBAC-aware (hide what the role can't use). Mobile → Sheet drawer.
- **Topbar**: project switcher, global search / ⌘K, theme toggle, settings, user avatar menu.
- Content: `PageHeader` (title, subtitle, primary action) + section grid.

## 5. Page-by-page redesign

### Dashboard

- Row of `StatCard`s (Targets, Scans, Live endpoints, Open vulns) with trend sparkline + delta.
- `SeverityDonut` + `TrendArea` (findings over 7 days) side by side.
- Threat-intel summary card with `RiskGauge` + top IoC/leak counts.
- "Recent scans" compact table with `StatusPill`. Empty state with a friendly CTA.

### Scans (list)

- `DataTable`: columns Target, Status (`StatusPill`), Severity mix (mini stacked bar), Counts
  (tabular), Started (relative time), Duration. Toolbar: search, status filter, profile filter.
- Primary action `New scan` opens a Dialog (target + profile pickers, summary of what will run).

### Scan detail

- Header: target + `StatusPill` (live pulse when running) + actions (Cancel, Re-scan, Report).
- **Stage stepper** (Subfinder → httpx → naabu → nuclei → wordfence) with per-stage state + counts,
  live updating (SSE). Below: `Timeline` of activity.
- Tabs: Overview · Subdomains · Endpoints · Ports · Vulnerabilities. Each a `DataTable`.
- Vulnerability rows: `SeverityBadge` + name + matched-at; expandable to `CodeBlock` request/response,
  CVE/CWE/CVSS chips, AI-enrichment panel (later).

### Targets / Settings / Threat Intel / Reports

- Targets: card grid or table, inline "scan" action, predefined-subs chips.
- Settings: tabbed (Profile, API Tokens, API Key Vault, Users & Roles, Integrations) — token shown
  once in a copyable callout; vault values masked with reveal.
- Threat Intel & Reports: laid out per their epics using the same system.

## 6. Implementation phases (maps to dashboard-ui epic)

1. **Tokens + Tailwind + shadcn/ui** in `@vacti/ui` (theme vars, fonts, dark/light). (epic 001)
2. **App shell**: sidebar + topbar + theme toggle + command palette skeleton. (epic 001)
3. **Primitives + composites**: StatCard, StatusPill, SeverityBadge, DataTable, EmptyState, Timeline.
4. **Redesign pages**: dashboard → scans → scan detail → targets → settings. (epic 003/004/002)
5. **Charts** (Recharts themed) + live SSE progress polish. (epic 003/004)
6. **Polish**: skeletons, motion, a11y pass, responsive, reduced-motion, keyboard nav. (epic 006)

New deps: `tailwindcss`, `@tailwindcss/postcss`, `tailwindcss-animate`, `class-variance-authority`,
`clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/*` (via shadcn), `sonner`, `cmdk`,
`@tanstack/react-table`, `recharts`, `framer-motion`, `next-themes`, `geist`.

## 7. Visual direction options (pick one)

- **A — "Midnight" (recommended).** Near-black cool-neutral bg, electric-blue accent, emerald/amber/
  red semantics. Linear/Vercel vibe. Professional, calm, great for long recon sessions.
- **B — "Slate Pro".** Lighter slate-gray dark theme, indigo/violet accent. Softer, enterprise SaaS
  feel (Stripe-ish).
- **C — "Terminal".** Deep black, mono-forward, phosphor-green/cyan accent, subtle grid texture.
  Hacker/SecOps aesthetic — striking but more niche.

All three share the same tokens/components; only the neutral temperature + accent + texture differ.

## 8. Definition of done (design)

- Consistent tokens across app + reports (severity/risk identical to data).
- Dark + light both polished; WCAG AA; keyboard + screen-reader navigable; reduced-motion honored.
- Every page has loading/empty/error states; tables are server-side and fast.
- A visual QA pass (screenshots) signed off before closing the redesign.
