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

import { loadProject, findCvaDefinition, findUsages } from "./discover.ts"
import { buildReport } from "./cluster.ts"
import type { ComponentReport } from "./types.ts"
import { renderDesignSystemHtml } from "../emit/render.ts"
import { buildChangeset } from "../emit/changeset.ts"
import { proposeHeuristic } from "../emit/propose-heuristic.ts"
import type { EmitItem } from "../emit/types.ts"

const DEFAULT_COMPONENTS = ["Button", "Card", "Badge", "Input"]

function usage(): void {
  console.error(
    [
      "driftfold — shadcn/cva drift folder",
      "",
      "Usage:",
      "  driftfold discover-cluster <Component> [--root <dir>] [--json]",
      "  driftfold emit [Component...] [--root <dir>]",
      "",
      "Options:",
      "  --root <dir>   target app root (default: fixture)",
      "  --json         emit the full ComponentReport as JSON",
      "",
      "emit writes design-system.html + changeset.json (heuristic proposals).",
      "For Opus-proposed variants, run the workflow: workflow/driftfold-reveal.js",
      "",
    ].join("\n"),
  )
}

function getFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i !== -1 ? args[i + 1] : undefined
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
 * Build EmitItems (report + heuristic proposal) for the given components.
 * The workflow swaps the heuristic proposal for the Opus one; this is the
 * deterministic offline path.
 */
export function emitItemsHeuristic(components: string[], root: string): EmitItem[] {
  return components.map((component) => {
    const report = discoverCluster(component, root)
    return { report, proposal: proposeHeuristic(report) }
  })
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
      if (rest.includes("--json")) {
        console.log(JSON.stringify(report, null, 2))
      } else {
        printSummary(report)
      }
      break
    }
    case "emit": {
      const root = getFlag(rest, "--root") ?? "fixture"
      const named = rest.filter((a) => !a.startsWith("-") && a !== getFlag(rest, "--root"))
      const components = named.length ? named : DEFAULT_COMPONENTS
      const items = emitItemsHeuristic(components, root)
      const html = renderDesignSystemHtml(items)
      const changeset = buildChangeset(items)
      Bun.write("design-system.html", html)
      Bun.write("changeset.json", JSON.stringify(changeset, null, 2))
      const clusters = items.reduce((n, i) => n + i.report.clusters.length, 0)
      const sites = items.reduce((n, i) => n + i.report.summary.drift_sites, 0)
      console.log(
        `\n  wrote design-system.html + changeset.json` +
          `\n  ${clusters} clusters · ${sites} drift sites · ${components.join(", ")}` +
          `\n  open design-system.html to annotate (heuristic proposals; run the workflow for Opus proposals)\n`,
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
