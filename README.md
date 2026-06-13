# DriftFold

> Crawl your shadcn/cva component drift, see it on one page, fold it back into canonical variants.

You built a `<Button>` once. Then across 40 pages people pasted `className="bg-blue-600 rounded-full shadow-lg"`
onto it in a dozen slightly-different ways. DriftFold finds every override, clusters the ones that are
secretly the same, shows you the whole mess on a single annotatable page, and — once you've marked what
should snap to what — rewrites the call sites and writes the lint rule that stops it happening again.

Stack scope: **Tailwind + shadcn + class-variance-authority (cva)**.

## How it runs

DriftFold is a **Claude Code workflow**, split into two runs around a human decision point:

```
Run 1 (workflow/driftfold-reveal.js)            [you annotate]            Run 2
─────────────────────────────────────           ───────────────          ─────────────────────
discover → cluster → Opus proposes      ──▶  design-system.html  ──▶  read changeset.json →
canonical variants → emits HTML +             (mark snap/keep/         refactor call sites →
empty changeset.json                          merge per cluster)       computed-style verify →
                                                                       write CLAUDE.md rules
                                              ↓ writes
                                          changeset.json  ◀── the boundary between the two runs
```

The split exists because the `Workflow` primitive runs detached and can't pause mid-run for human
input. `changeset.json` on disk carries the decision from Run 1 to Run 2.

## Layout

| Dir         | What                                                                      |
|-------------|---------------------------------------------------------------------------|
| `cli/`      | Deterministic core: discover → resolve (`cn`/`twMerge`) → cluster → partition. ts-morph, syntactic-only. |
| `workflow/` | The `Workflow` scripts. `driftfold-reveal.js` = Run 1.                     |
| `emit/`     | Renders `design-system.html` (the control surface) + the empty changeset. |
| `fixture/`  | A seeded shadcn app with deliberate drift — the demo surface.             |

## Status

**Run 1 (reveal) works end-to-end.** Point it at the bundled fixture:

```bash
bun install
cd fixture && bun install && cd ..
bun test                                    # deterministic core, 11 pass
bun run cli/index.ts emit && open design-system.html   # instant, offline (heuristic proposals)
```

For the Opus-authored variant names + the `bg-[#2563eb] → bg-blue-600` merge, run the
workflow (`workflow/driftfold-reveal.js`) from Claude Code. Full runbook: `DEMO.md`.

Run 2 (refactor call sites + write the CLAUDE.md lint rule) is the next build; the
locked `changeset.json` contract is already emitted so Run 2 has its input.

## Known limitations

The deterministic core is syntactic (ts-morph, no type-checking) and scoped to the
common shadcn/cva shape. Deliberately out of Day-1 scope (deferred to OSS hardening):

- **cva discovery is by naming convention** (`<component>Variants`). A component styled
  by a differently-named cva — `toggleVariants` behind `<ToggleGroupItem>`,
  `navigationMenuTriggerStyle`, a reused `buttonVariants` — isn't found, and that one
  component fails loud rather than guessing.
- **Tag matching is textual.** Aliased imports (`Button as Btn`), namespaced usages
  (`<UI.Button>`), and an unrelated local component that happens to be named `Button`
  are not disambiguated — they'd under- or over-count.
- **cva values must be string literals.** Template-literal bases, `cn()`/computed
  variant values, and `compoundVariants` are not read into the variant inventory, so a
  cluster that actually matches such a variant may be proposed as new.
- **Spurious extra clusters are by design.** Arbitrary values (`bg-[#2563eb]`) and
  `!important` produce separate clusters from their named-equivalent — the human merges
  them in the annotation layer (this is the `btn-4 → btn-1` demo moment).
- **Cluster keys track the installed `tailwind-merge`** (Tailwind v3 / tailwind-merge v2
  conflict map assumed). A major bump can shift which tokens collapse.

`className={cn("static classes")}` (the most common real override form) *is* handled —
it resolves to a static, clusterable override; only `cn()` with a conditional/computed
arg stays untouchable.

## License

TBD (OSS — extract target).
