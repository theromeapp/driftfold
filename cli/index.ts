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

function usage(): void {
  console.error(
    [
      "driftfold — shadcn/cva drift folder",
      "",
      "Usage:",
      "  driftfold discover-cluster <Component> [--root <dir>] [--json]",
      "",
      "Options:",
      "  --root <dir>   target app root (default: fixture)",
      "  --json         emit the full ComponentReport as JSON",
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
