# DriftFold — demo runbook

A ~90-second videoable run. DriftFold crawls a Tailwind + shadcn/cva app, clusters
`className`-override drift, has Opus propose canonical variants, and emits an
annotatable control surface. The fixture (`fixture/`) is the demo surface — its drift
is planted and the counts are known (`fixture/DRIFT-MAP.md`).

---

## 0. One-time setup

```bash
cd ~/Development/driftfold
bun install                 # root (CLI: ts-morph, tailwind-merge, clsx)
cd fixture && bun install   # fixture (Next 14, Tailwind, cva)
cd ..
```

## 1. Pre-flight spot-check (do this before recording — 60 seconds)

Smoke tests are count-aware, but eyeball the ground truth once so a miscount can't
sneak into the take:

```bash
bun test                                          # 10 pass
for c in Button Card Badge Input; do bun run cli/index.ts discover-cluster $c; done
```

Expect (matches `fixture/DRIFT-MAP.md`): **Button 6 clusters / 12 sites · Card 2 / 5 ·
Badge 2 / 4 · Input 0 (clean wall)**.

---

## The 90 seconds

### Beat 1 — the problem (0:00–0:15)

```bash
bun run fixture:dev   # http://localhost:4310
```

Open **`/`** then **`/settings`** side by side. Point at:

- Home "Continue" is a **blue pill**; settings "Upgrade" is the **same blue pill** —
  but they were written differently (`bg-blue-600` vs `bg-[#2563eb]`). Identical
  pixels, divergent code.
- Buttons across pages are subtly inconsistent (pill vs square, hand-rolled red vs
  the real `destructive` variant). Nobody decided this — it drifted.

> Script line: *"Same button, built six different ways across the app. No one can see
> the whole mess at once — so it never gets fixed."*

### Beat 2 — the reveal (0:15–0:45)

Run Run 1 — the **Claude Code workflow** (workflow-native: it fans out one agent per
component, the CLI clusters deterministically, **Opus** names the variants):

In Claude Code:

```
Run the workflow at workflow/driftfold-reveal.js
```

(or programmatically: `Workflow({ scriptPath: "workflow/driftfold-reveal.js" })`)

Watch `/workflows` — `discover:*` → `propose:*` per component, then `emit`. ~60s, ~8
agents. It writes **`design-system.html`** + **`changeset.json`**.

> Script line: *"DriftFold crawls every usage, clusters the ones that are secretly the
> same, and Opus proposes what each should become."*

### Beat 3 — the control surface (0:45–1:15) ← the money moment

```bash
open design-system.html
```

Walk the Button row:

- **`btn-1` "cta" ×4** — one blue-pill look used four times → snap to a `cta` variant.
- **`btn-4` (purple-bordered = merge) → merge-into `btn-1`.** This is the payoff:
  `bg-[#2563eb]` is the literal hex of `blue-600`, so it renders **identical** to
  `btn-1` — the swatch proves it — and Opus flagged it to fold in. *"These two are the
  same button. DriftFold knew."*
- **`btn-3` → merge-into `destructive`** — hand-rolled red that just re-implements the
  variant that already exists.
- **`btn-5` "likely mistake"** — `bg-blue-600 text-blue-600`, blue-on-blue, illegible.
  Opus caught the bug, not just the drift.
- **Card** → `card-1` folds into the existing `elevated` variant; **Input** → *"clean,
  no appearance drift"* (proof it doesn't cry wolf).

### Beat 4 — annotate & hand off (1:15–1:30)

In the live **changeset.json** dock at the bottom: flip one cluster's decision (e.g.
`btn-6` keep → snap-to), watch the JSON update live, hit **Download changeset.json**.

> Closing line: *"You annotate on the page; the changeset is the contract. Run 2 reads
> it, rewrites every call site, and writes the CLAUDE.md rule so it can't drift back."*
> (Run 2 — refactor + lint rule — is the next build; Run 1 reveal is what ships today.)

---

## Fallback — instant, offline, no agents

If you can't run a live workflow (no network, or you want a deterministic take), the
CLI emits the same surface with a built-in heuristic proposer:

```bash
bun run cli/index.ts emit          # writes design-system.html + changeset.json instantly
open design-system.html
```

It's the same page; only the variant *names* are heuristic instead of Opus-authored
(e.g. `card-1` shows a placeholder name instead of "elevated"). Use the live workflow
for the hero take — the Opus naming and the `btn-4 → btn-1` merge are the wow.

---

## What to say if asked "does it work on a real app?"

Point `--root` at any Tailwind+shadcn+cva tree:

```bash
bun run cli/index.ts discover-cluster Button --root ../your-app
```

Honest scope: it folds the four appearance families the design system actually drifts
on — **color, radius, shadow, padding** (+ gradients/ring/opacity/type). Layout
(`w-*`, `m-*`, `col-span-*`) and out-of-scope visual utils (`transition-*`,
`animate-*`, `cursor-*`) are deliberately kept at the call site, and dynamic/conditional
classNames are flagged untouchable — DriftFold never rewrites what it can't prove.

---

## Reset between takes

```bash
rm -f design-system.html changeset.json && rm -rf .driftfold-cache
```
