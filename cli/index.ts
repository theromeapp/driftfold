#!/usr/bin/env bun
/**
 * DriftFold CLI — deterministic core.
 *
 * Subcommands (planned):
 *   discover-cluster <Component> [--json]   discover overrides → resolve cn() → cluster → partition
 *
 * Determinism lives here; judgment (naming variants, flagging outliers) lives in the
 * Workflow's Opus agent() step. See CLAUDE.md.
 */

const [, , command, ...rest] = process.argv

function usage(): void {
  console.error(
    [
      "driftfold — shadcn/cva drift folder",
      "",
      "Usage:",
      "  driftfold discover-cluster <Component> [--json]",
      "",
    ].join("\n"),
  )
}

switch (command) {
  case "discover-cluster": {
    // T1: implement discover → resolve → cluster → partition. Emits cluster JSON on --json.
    throw new Error("discover-cluster: not implemented yet (T1)")
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
