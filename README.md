<div align="center">

# DriftFold

**Crawl your shadcn/cva component drift, see it all on one page, and fold it back into canonical variants.**

[![Built with Bun](https://img.shields.io/badge/built%20with-bun-000?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Claude Code Workflow](https://img.shields.io/badge/Claude%20Code-workflow--native-d97757)](https://claude.com/claude-code)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

</div>

---

You built a `<Button>` once. It was clean. It was good.

Then it went out into the world. Across 40 pages, a dozen different people pasted
`className="bg-blue-600 rounded-full shadow-lg"` onto it — each in a slightly different way.
One person wrote `bg-blue-600`. Another wrote `bg-[#2563eb]` (same pixels, different code).
Someone hand-rolled a red button that already existed as `variant="destructive"`. Nobody
*decided* any of this. It just **drifted**.

The problem isn't that the drift exists. It's that **no one can see all of it at once** — so it
never gets fixed.

DriftFold fixes that. It finds every override, clusters the ones that are secretly the same,
shows you the entire mess on a single annotatable page, has Opus propose what each cluster
*should* become — and once you've marked your decisions, rewrites the call sites and writes the
lint rule that stops it from happening again.

> **Scope:** Tailwind + shadcn + [class-variance-authority (cva)](https://cva.style). That's the
> sweet spot, and we lean into it hard.

## What you get

- 🔍 **Deterministic discovery.** A pure ts-morph pass crawls every `<Button>`, `<Card>`, etc.,
  resolves classes through your app's real `cn()` (`twMerge(clsx(...))`) semantics, and clusters
  overrides that normalize to the same thing. No guessing — same input, same clusters, every time.
- 🎨 **Appearance vs. layout, separated.** Color, radius, shadow, and padding get folded into
  variants. Layout (`w-full`, `mt-3`, `col-span-2`) stays put at the call site, where it belongs.
- 🧠 **Opus does the judgment.** Naming the canonical variant, spotting `bg-[#2563eb]` as a dupe of
  `blue-600`, flagging `bg-blue-600 text-blue-600` as a bug — that's the model's job, not a regex's.
- 📄 **One page to rule it all.** An interactive `design-system.html` control surface with live
  swatches, so you can *see* that two "different" buttons render identically.
- 📝 **A changeset you control.** You annotate on the page; the changeset is the contract. Nothing
  gets rewritten until you say so.

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

Why two runs? The `Workflow` primitive runs detached and can't pause mid-run for human input. So
`changeset.json` on disk is the handoff: Run 1 writes it empty, you fill it in, Run 2 reads it.

## Quickstart

You'll need [Bun](https://bun.sh) `>=1.2`. Then:

```bash
bun install
cd fixture && bun install && cd ..

bun test                                                 # deterministic core, 11 pass
bun run cli/index.ts emit && open design-system.html     # instant, offline, heuristic proposals
```

That gives you the reveal page running offline in seconds. For the **full experience** — Opus
authoring the variant names and catching that `bg-[#2563eb] → bg-blue-600` merge — run the
workflow from Claude Code:

```
Run the workflow at workflow/driftfold-reveal.js
```

The bundled `fixture/` app has deliberately planted drift (see `fixture/DRIFT-MAP.md` for the
known counts) so you can watch the whole thing work end-to-end. The full ~90-second runbook lives
in **[`DEMO.md`](./DEMO.md)**.

## Layout

| Dir         | What                                                                      |
|-------------|---------------------------------------------------------------------------|
| `cli/`      | Deterministic core: discover → resolve (`cn`/`twMerge`) → cluster → partition. ts-morph, syntactic-only. |
| `workflow/` | The `Workflow` scripts. `driftfold-reveal.js` = Run 1.                     |
| `emit/`     | Renders `design-system.html` (the control surface) + the empty changeset. |
| `fixture/`  | A seeded shadcn app with deliberate drift — the demo surface.             |

## Status & roadmap

**Run 1 (reveal) works end-to-end today.** It discovers, clusters, proposes, and emits the control
surface plus the locked `changeset.json` contract.

- [x] **Run 1 — Reveal.** discover → cluster → Opus propose → emit HTML + changeset
- [ ] **Run 2 — Fold.** read `changeset.json` → refactor call sites → computed-style verify →
      write CLAUDE.md rules *(next build — the contract is already emitted, so the input exists)*
- [ ] **Golden-fixture clustering tests** to replace smoke-only coverage
- [ ] **Broader cva discovery** (beyond the `<component>Variants` naming convention)

## Known limitations

We'd rather be honest than oversell. The deterministic core is syntactic (ts-morph, no
type-checking) and scoped to the common shadcn/cva shape. These are deliberately out of Day-1 scope
— and several make **great first contributions** (see below):

- **cva discovery is by naming convention** (`<component>Variants`). A component styled by a
  differently-named cva — `toggleVariants` behind `<ToggleGroupItem>`, `navigationMenuTriggerStyle`,
  a reused `buttonVariants` — isn't found, and that component fails loud rather than guessing.
- **Tag matching is textual.** Aliased imports (`Button as Btn`), namespaced usages (`<UI.Button>`),
  and an unrelated local component that happens to be named `Button` aren't disambiguated.
- **cva values must be string literals.** Template-literal bases, `cn()`/computed variant values, and
  `compoundVariants` aren't read into the variant inventory, so a cluster that actually matches such a
  variant may be proposed as new.
- **Spurious extra clusters are by design.** Arbitrary values (`bg-[#2563eb]`) and `!important` get
  their own clusters separate from their named equivalent — the human merges them in the annotation
  layer (this is the `btn-4 → btn-1` demo moment).
- **Cluster keys track the installed `tailwind-merge`** (Tailwind v3 / tailwind-merge v2 conflict map
  assumed). A major bump can shift which tokens collapse.

The good news: `className={cn("static classes")}` — the most common real override form — *is*
handled. It resolves to a static, clusterable override. Only `cn()` with a conditional/computed arg
stays untouchable.

## Contributing

**This is where you come in.** 💛

DriftFold scratches a real itch — design-system drift is one of those problems every growing
frontend team hits and almost nobody has tooling for. We extracted it as OSS precisely because it
deserves more hands than ours. If any of this resonates, we'd genuinely love your help.

You don't have to be an AST wizard. Here are concrete ways to pitch in, roughly easiest to hardest:

- 🐛 **Report drift we miss (or over-count).** Point DriftFold at your own shadcn/cva app and tell us
  where it surprised you. A failing real-world case is one of the most valuable things you can file —
  [open an issue](https://github.com/theromeapp/driftfold/issues/new).
- 📖 **Improve the docs.** If the quickstart or `DEMO.md` tripped you up, that's a bug in the README,
  not in you. PRs that smooth the on-ramp are always welcome.
- 🧪 **Add a golden-fixture test.** Smoke-only coverage means a clustering miscount can slip by
  silently. Help us pin cluster counts down with real assertions — see `fixture/DRIFT-MAP.md` for the
  ground truth.
- 🏷️ **Teach it to find more cva.** Discovery is currently by naming convention; resolving aliased
  imports (`Button as Btn`), namespaced usages (`<UI.Button>`), or non-`<component>Variants` cva
  definitions would meaningfully widen what DriftFold handles.
- 🔧 **Help build Run 2 (Fold).** The refactor-and-protect half — rewriting call sites and writing the
  CLAUDE.md lint rule — is the next big piece. The `changeset.json` contract is already locked, so the
  input is waiting for you.

### Getting started locally

```bash
git clone https://github.com/theromeapp/driftfold.git
cd driftfold
bun install
cd fixture && bun install && cd ..
bun test                  # everything green? you're ready.
```

A few house rules to keep things smooth:

- **`bun` for everything** — never `npm install`. (The lockfile and CI assume it.)
- **Determinism lives in the TS CLI; judgment lives in `agent()`.** Clustering is a pure, syntactic
  pass — please don't ask an agent to do the clustering, and don't sneak heuristics into the CLI that
  belong to the model. Keeping that line clean is what makes the whole thing trustworthy.
- **Smoke tests must stay green** (`bun test`). If you touch clustering, eyeball the fixture counts in
  `fixture/DRIFT-MAP.md` too.

Not sure where to start, or want to talk through an idea before writing code? **Open an issue and say
hi** — questions are contributions too, and we'd rather help you find the right thread than have you
guess.

And if DriftFold saved you from a wall of drift — a ⭐ on the repo genuinely helps others find it.

## Acknowledgements

Built on the shoulders of [ts-morph](https://ts-morph.com),
[tailwind-merge](https://github.com/dcastil/tailwind-merge),
[clsx](https://github.com/lukeed/clsx), and [cva](https://cva.style) — and orchestrated with
[Claude Code](https://claude.com/claude-code)'s `Workflow` primitive. Thank you to the maintainers of
each.

## License

TBD (OSS — extract target). License coming as part of the public release; until then, treat it as
source-available for evaluation and contribution.
