#!/usr/bin/env bun
/**
 * DriftFold CLI — deterministic core.
 *
 * Subcommands:
 *   discover-cluster <Component> [--root <dir>] [--json]
 *       discover cva def + JSX usages → resolve cn() → cluster → partition.
 *       --json  emit the full ComponentReport as JSON (consumed by the workflow).
 *       (default: a human-readable summary)
 *
 * Determinism lives here; judgment (naming variants, flagging outliers) lives in
 * the Workflow's Opus agent() step. See CLAUDE.md.
 */

import path from "node:path"
import { readFileSync } from "node:fs"

import { loadProject, findCvaDefinition, findUsages } from "./discover.ts"
import { buildReport } from "./cluster.ts"
import type { ComponentReport } from "./types.ts"
import { renderDesignSystemHtml } from "../emit/render.ts"
import { buildChangeset } from "../emit/changeset.ts"
import { proposeHeuristic } from "../emit/propose-heuristic.ts"
import type { ComponentProposal, EmitItem } from "../emit/types.ts"

const DEFAULT_COMPONENTS = ["Button", "Card", "Badge", "Input"]

function usage(): void {
  console.error(
    [
      "driftfold — shadcn/cva drift folder",
      "",
      "Usage:",
      "  driftfold discover-cluster <Component> [--root <dir>] [--json]",
      "  driftfold emit [Component...] [--root <dir>] [--proposals <file>]",
      "",
      "Options:",
      "  --root <dir>        target app root (default: fixture)",
      "  --json              (discover-cluster) emit the full ComponentReport as JSON",
      "  --proposals <file>  (emit) ComponentProposal[] JSON from the Opus propose step",
      "  --out <file>        (emit) HTML output path (default: design-system.html)",
      "  --changeset <file>  (emit) changeset output path (default: changeset.json)",
      "",
      "emit writes design-system.html + changeset.json. Without --proposals it uses",
      "the deterministic heuristic; the workflow supplies Opus proposals.",
      "Workflow (Run 1): workflow/driftfold-reveal.js",
      "",
    ].join("\n"),
  )
}

function getFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i !== -1 ? args[i + 1] : undefined
}

/**
 * The judgment-relevant slice of a report, for the workflow's Opus propose step.
 * This is the exact shape the propose agent reasons over — emit independently
 * re-discovers the full report, so this projection never has to carry call sites.
 */
export interface ProposeInput {
  component: string
  has_drift: boolean
  /** the cva's existing variants, flattened — Opus maps clusters onto these */
  existing_variants: { group: string; name: string; classes: string }[]
  clusters: {
    cluster_id: string
    appearance_utils: string[]
    site_count: number
    is_outlier: boolean
  }[]
}

export function toProposeInput(report: ComponentReport): ProposeInput {
  const existing_variants = Object.entries(report.variant_inventory).flatMap(
    ([group, keys]) =>
      Object.entries(keys).map(([name, classes]) => ({ group, name, classes })),
  )
  return {
    component: report.component,
    has_drift: report.clusters.length > 0,
    existing_variants,
    clusters: report.clusters.map((c) => ({
      cluster_id: c.cluster_id,
      appearance_utils: c.appearance_utils,
      site_count: c.site_count,
      is_outlier: c.is_outlier,
    })),
  }
}

export function discoverCluster(component: string, root: string): ComponentReport {
  const absRoot = path.resolve(process.cwd(), root)
  const project = loadProject(absRoot)
  const def = findCvaDefinition(project, component, absRoot)
  if (!def) {
    throw new Error(
      `No cva definition found for "${component}" under ${root} ` +
        `(expected a \`const ${component.toLowerCase()}Variants = cva(...)\`).`,
    )
  }
  const usages = findUsages(project, component, def, absRoot)
  return buildReport(component, def, usages)
}

/**
 * Build EmitItems for the given components. Reports are always (re)discovered
 * deterministically by the CLI — the single source of truth. Proposals come from
 * `opusProposals` when supplied (the workflow's Opus judgment), falling back to
 * the deterministic heuristic per-cluster for any cluster Opus didn't cover.
 */
export function emitItems(
  components: string[],
  root: string,
  opusProposals?: ComponentProposal[],
): EmitItem[] {
  const byComponent = new Map(
    (opusProposals ?? []).map((p) => [p.component, p]),
  )
  return components.map((component) => {
    const report = discoverCluster(component, root)
    const heuristic = proposeHeuristic(report)
    const opus = byComponent.get(component)
    if (!opus) return { report, proposal: heuristic }

    // Overlay Opus proposals; fall back to heuristic for any uncovered cluster.
    const opusById = new Map(opus.proposals.map((p) => [p.cluster_id, p]))
    const merged = report.clusters.map((c) => {
      const o = opusById.get(c.cluster_id)
      if (o) return o
      return (
        heuristic.proposals.find((h) => h.cluster_id === c.cluster_id) ?? {
          cluster_id: c.cluster_id,
          decision: "keep" as const,
          target_variant: "",
          is_mistake: false,
          rationale: "",
        }
      )
    })
    return { report, proposal: { component, proposals: merged } }
  })
}

/** @deprecated use emitItems(components, root) — kept for test back-compat. */
export function emitItemsHeuristic(components: string[], root: string): EmitItem[] {
  return emitItems(components, root)
}

function printSummary(report: ComponentReport): void {
  const { component, summary, clusters } = report
  const lines: string[] = []
  lines.push(`\n  ${component} — ${summary.cluster_count} clusters, ${summary.drift_sites} drift sites`)
  lines.push(`  (${summary.clean} layout-only · ${summary.dynamic} dynamic/untouchable)\n`)
  for (const c of clusters) {
    const tag = c.is_outlier ? " ⚠ outlier" : ""
    lines.push(`  ${c.cluster_id}  ×${c.site_count}${tag}`)
    lines.push(`    ${c.appearance_utils.join(" ")}`)
    for (const s of c.call_sites) {
      const layout = s.layout_utils.length ? `  +keep[${s.layout_utils.join(" ")}]` : ""
      lines.push(`      ${s.file}:${s.line}  (variant=${s.variant ?? "—"} size=${s.size ?? "—"})${layout}`)
    }
    lines.push("")
  }
  if (report.dynamic.length) {
    lines.push("  dynamic (untouchable):")
    for (const d of report.dynamic) lines.push(`      ${d.file}:${d.line}  ${d.raw}`)
    lines.push("")
  }
  console.log(lines.join("\n"))
}

function main(): void {
  const [, , command, ...rest] = process.argv
  switch (command) {
    case "discover-cluster": {
      const component = rest.find((a) => !a.startsWith("-"))
      if (!component) {
        console.error("discover-cluster: missing <Component>\n")
        usage()
        process.exit(1)
      }
      const root = getFlag(rest, "--root") ?? "fixture"
      const report = discoverCluster(component, root)
      if (rest.includes("--propose-input")) {
        console.log(JSON.stringify(toProposeInput(report), null, 2))
      } else if (rest.includes("--json")) {
        console.log(JSON.stringify(report, null, 2))
      } else {
        printSummary(report)
      }
      break
    }
    case "emit": {
      const root = getFlag(rest, "--root") ?? "fixture"
      const proposalsPath = getFlag(rest, "--proposals")
      const outHtml = getFlag(rest, "--out") ?? "design-system.html"
      const outChangeset = getFlag(rest, "--changeset") ?? "changeset.json"
      const flagValues = new Set(
        ["--root", "--proposals", "--out", "--changeset"]
          .map((f) => getFlag(rest, f))
          .filter((v): v is string => v !== undefined),
      )
      const named = rest.filter((a) => !a.startsWith("-") && !flagValues.has(a))
      const components = named.length ? named : DEFAULT_COMPONENTS

      let opusProposals: ComponentProposal[] | undefined
      if (proposalsPath) {
        const raw = readFileSync(path.resolve(process.cwd(), proposalsPath), "utf8")
        opusProposals = JSON.parse(raw) as ComponentProposal[]
      }

      const items = emitItems(components, root, opusProposals)
      const html = renderDesignSystemHtml(items)
      const changeset = buildChangeset(items)
      Bun.write(outHtml, html)
      Bun.write(outChangeset, JSON.stringify(changeset, null, 2))
      const clusters = items.reduce((n, i) => n + i.report.clusters.length, 0)
      const sites = items.reduce((n, i) => n + i.report.summary.drift_sites, 0)
      const src = proposalsPath ? `Opus proposals (${proposalsPath})` : "heuristic proposals"
      console.log(
        `\n  wrote ${outHtml} + ${outChangeset}` +
          `\n  ${clusters} clusters · ${sites} drift sites · ${components.join(", ")}` +
          `\n  proposals: ${src}` +
          `\n  open ${outHtml} to annotate\n`,
      )
      break
    }
    case undefined:
    case "-h":
    case "--help":
      usage()
      process.exit(command === undefined ? 1 : 0)
    default:
      console.error(`Unknown command: ${command}\n`)
      usage()
      process.exit(1)
  }
}

if (import.meta.main) main()
