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

Pre-build. Architecture is locked (see `CLAUDE.md`). Build order: fixture → CLI core →
workflow + emitter → rehearse.

## License

TBD (OSS — extract target).
