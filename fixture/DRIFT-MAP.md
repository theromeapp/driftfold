# Fixture drift map (ground truth)

This Next.js app has **deliberately planted** `className`-override drift. These counts are
the contract DriftFold must reproduce. Use this table for the 60-second manual spot-check
before recording the demo (per CLAUDE.md "Accepted critical gap" — clustering miscount is
silent under smoke-only tests).

Clustering rule under test: usages are grouped by the **sorted set of appearance utilities**
in their static `className` override (after `twMerge` normalization). Layout utilities
(`m-*`, `w-*`, `col-span-*`, positioning) are partitioned out and **kept** at the call site.
Dynamic/conditional classNames (`cn(...)`, ternaries) are **excluded** and flagged untouchable.

## Button — 6 clusters, 12 drift sites

| Cluster | Appearance set (override) | Sites | Files | Decision (expected) |
|---------|---------------------------|-------|-------|---------------------|
| **A** blue-primary | `bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg` | 4 | page, checkout, dashboard, billing | snap-to new `primary` variant |
| **B** arbitrary-blue | `bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-full shadow-lg` | 1 | settings | **merge-into A** (pixels identical, syntactically distinct — the money moment) |
| **C** green-success | `bg-green-600 hover:bg-green-700 text-white` | 3 | page, profile, onboarding | snap-to new `success` variant |
| **D** red | `bg-red-600 hover:bg-red-700 text-white` | 2 | dashboard, billing | merge-into existing `destructive` variant |
| **outlier-1** blue-on-blue | `bg-blue-600 text-blue-600` | 1 | profile | flag as mistake (illegible) |
| **outlier-2** purple | `bg-purple-500 rounded-none shadow-2xl px-12 text-xs` | 1 | onboarding | flag as one-off |

Token order varies across A's sites (canonical / `shadow-lg rounded-full` swapped /
`rounded-full` leading) — they must still collapse to **one** cluster. That's the
twMerge-normalization test.

### Button — NOT drift (must be excluded)
- `variant="secondary" className="w-full"` (page) — layout-only, KEPT
- `variant="outline" className="w-full mt-3"` (checkout) — layout-only, KEPT
- `variant="outline" className="ml-auto"` (settings) — layout-only, KEPT
- `variant="ghost" className="col-span-2 w-full"` (dashboard) — layout-only, KEPT
- `className={cn(isLoading && "opacity-50", "w-full")}` (checkout) — dynamic, untouchable
- `className={isPrimary ? "bg-blue-600 text-white" : "bg-gray-200"}` (settings) — conditional, untouchable

## Card — 2 clusters, 5 drift sites

| Cluster | Appearance set | Sites | Files | Decision (expected) |
|---------|----------------|-------|-------|---------------------|
| **accent-border** | `border-blue-500 shadow-lg` | 2 | page, settings | snap-to new `accent` variant |
| **elevated-shadow** | `shadow-md` | 3 | dashboard, billing, profile | merge-into existing `elevated` variant (`elevated === shadow-md`) |

Token order varies (`border-blue-500 shadow-lg` vs `shadow-lg border-blue-500`) — one cluster.

### Card — NOT drift
- `className="mt-6"` (onboarding) — layout-only, KEPT

## Badge — 2 clusters, 4 drift sites

| Cluster | Appearance set | Sites | Files | Decision (expected) |
|---------|----------------|-------|-------|---------------------|
| **status-green** | `bg-green-100 text-green-800` | 2 | dashboard, profile | snap-to new `success` variant |
| **muted-gray** | `bg-gray-100 text-gray-600 rounded-sm` | 2 | settings, billing | snap-to new `muted` variant |

## Input — 0 clusters (the clean wall)

Input is overridden only with `w-full` (layout) on checkout, settings, profile. DriftFold must
report **no appearance drift** — exercises the empty-state path.

## Totals

| Component | Clusters | Drift sites | Clean/layout-only | Dynamic |
|-----------|----------|-------------|-------------------|---------|
| Button    | 6        | 12          | 4                 | 2       |
| Card      | 2        | 5           | 1                 | 0       |
| Badge     | 2        | 4           | 0                 | 0       |
| Input     | 0        | 0           | 3                 | 0       |
