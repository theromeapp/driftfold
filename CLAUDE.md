# DriftFold

A reusable Claude Code workflow that crawls shadcn-style component usage in a
Tailwind + cva app, clusters `className`-override drift, has Opus propose canonical
`cva` variants, emits an HTML control surface, lets a human annotate it into a
changeset, then executes the refactor and writes CLAUDE.md rules to prevent recurrence.

This repo is the OSS extraction. The demo target is a ~90-second videoable hackathon run.

## Locked decisions (from the engineering review — do not relitigate)

1. **Workflow-native is a MUST.** Orchestration uses Claude Code's real `Workflow`
   primitive (`agent()` / `pipeline()` / `parallel()` / `phase()`), not a loose CLI loop.
2. **Two Workflow runs, split at the human-annotation gate.** The `Workflow` primitive
   runs detached and CANNOT block mid-run for human input. So:
   - **Run 1 (`workflow/driftfold-reveal.js`)** — discover → cluster → Opus propose → emit
     `design-system.html` + empty `changeset.json`. STOPS.
   - Human annotates the HTML → writes `changeset.json`.
   - **Run 2** — read `changeset.json` → execute refactor → computed-style verify → CLAUDE.md rules.
   - `changeset.json` on disk IS the boundary between runs. (`resumeFromRunId` is for replaying
     cached prefixes after script edits, NOT for human-in-the-loop pauses.)
3. **Determinism lives in the TS CLI, judgment lives in `agent()`.** Clustering is a pure,
   deterministic `cli/` pass (ts-morph, syntactic-only). Opus only does the Propose step
   (naming variants, flagging outliers as mistakes). Never ask an agent to do the clustering.
4. **Run 1 is a per-component `pipeline()`** over `[Button, Card, Badge, Input]`:
   `discover-cluster` (CLI-backed) → `propose` (Opus agent). No barrier between components.
5. **Full `changeset.json` schema is locked Day 1** (see below) even though writeback (Run 2)
   ships Day 2. Reveal-only is the Day 1 deliverable.

## Scope lock

- **Stack: Tailwind + shadcn + cva ONLY.** No CSS-in-JS, no styled-components, no other
  component libraries. The two AST targets are (a) the `cva()` definition and (b) JSX usages.
- **Appearance vs layout partition:** fold *appearance* utilities (color, radius, shadow,
  padding) into cva variants; leave *layout/contextual* utilities (`m-*`, `w-*`, `col-span-*`,
  positioning) in place at the call site.
- **Clustering merges through the app's `cn()` semantics** = `twMerge(clsx(...))`. `twMerge` is
  variant-aware. The real clustering risk is spurious EXTRA clusters (arbitrary values
  `bg-blue-600` vs `bg-[#2563eb]`, theme tokens) — the human merges those in the annotation layer.

## changeset.json schema (locked)

```json
{ "component": "Button",
  "clusters": [{ "cluster_id": "btn-3", "decision": "snap-to | keep | rename | merge-into",
    "target_variant": "primary", "folded_utils": ["bg-blue-600","rounded-full","shadow-lg"],
    "kept_utils": ["w-full","mt-3"],
    "call_sites": [{ "file": "app/x/page.tsx", "line": 42, "variant": "default", "size": "lg" }] }] }
```

## Test depth

- **Smoke-only for the hackathon** (runs without throwing). Golden-fixture clustering tests are
  DEFERRED to the OSS hardening pass.
- **Accepted critical gap:** smoke-only means a clustering miscount is silent. Mitigation = a
  60-second manual spot-check of the fixture's known cluster counts BEFORE recording.

## Conventions

- `bun` for everything — never `npm install`.
- The `fixture/` app is the PRIMARY demo surface (grounding: real apps like Tato have clean
  Buttons — 33/638 overrides, mostly layout — so the "wall of drift" won't materialize on a real
  Button. Seed deliberate appearance drift instead, ≥1 component at 6+ effective sets).
