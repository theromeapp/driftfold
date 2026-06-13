/**
 * Deterministic, no-LLM proposal heuristic.
 *
 * Purpose: (1) a fast offline path / fallback when the workflow's Opus agent is
 * unavailable, and (2) a stable input for testing the emitter. The REAL judgment
 * (precise variant names, "these two arbitrary/named colors are identical, merge
 * btn-4 → btn-1", subtle mistakes) comes from the Opus `propose` step in the
 * workflow — this heuristic is intentionally modest.
 */

import type { ComponentReport } from "../cli/types.ts"
import { utilityCore } from "../cli/classify.ts"
import type { ClusterProposal, ComponentProposal } from "./types.ts"

const COLOR_TO_NAME: Record<string, string> = {
  blue: "primary",
  indigo: "primary",
  green: "success",
  emerald: "success",
  red: "destructive",
  rose: "destructive",
  gray: "muted",
  zinc: "muted",
  slate: "muted",
  neutral: "muted",
  purple: "accent",
  violet: "accent",
}

/** Pull the color family from the first background utility, if any. */
function colorFamily(utils: string[]): string | null {
  for (const u of utils) {
    const core = utilityCore(u)
    const m = core.match(/^bg-([a-z]+)-\d+/)
    if (m) return m[1] ?? null
  }
  return null
}

function hasArbitrary(utils: string[]): boolean {
  return utils.some((u) => u.includes("-["))
}

export function proposeHeuristic(report: ComponentReport): ComponentProposal {
  const existingVariants = new Set(
    Object.values(report.variant_inventory).flatMap((g) => Object.keys(g)),
  )

  const proposals: ClusterProposal[] = report.clusters.map((c) => {
    const utils = c.appearance_utils

    // Arbitrary hex values almost always duplicate a named cluster — flag to merge.
    if (hasArbitrary(utils)) {
      return {
        cluster_id: c.cluster_id,
        decision: "merge-into",
        target_variant: "",
        is_mistake: false,
        rationale:
          "Uses an arbitrary color value — likely identical to a named cluster. Merge it into that variant.",
      }
    }

    const family = colorFamily(utils)
    const name = family ? COLOR_TO_NAME[family] ?? family : null

    // Color maps to a variant the cva already defines → merge into it.
    if (name && existingVariants.has(name)) {
      return {
        cluster_id: c.cluster_id,
        decision: "merge-into",
        target_variant: name,
        is_mistake: false,
        rationale: `Re-implements the existing "${name}" variant by hand. Merge into it.`,
      }
    }

    // Lone outlier that isn't a recognizable palette color → probably a mistake.
    if (c.is_outlier && !name) {
      return {
        cluster_id: c.cluster_id,
        decision: "keep",
        target_variant: "",
        is_mistake: true,
        rationale: "One-off that matches nothing else — review before folding.",
      }
    }

    // Lone outlier with a recognizable color → still suspicious (e.g. bg/text same hue).
    if (c.is_outlier) {
      return {
        cluster_id: c.cluster_id,
        decision: "keep",
        target_variant: "",
        is_mistake: true,
        rationale: "Single use — confirm it's intentional, not a copy-paste slip.",
      }
    }

    // Repeated appearance set → promote to a new named variant.
    return {
      cluster_id: c.cluster_id,
      decision: "snap-to",
      target_variant: name ?? `${c.cluster_id}-variant`,
      is_mistake: false,
      rationale: `${c.site_count} call sites share this exact look — make it the "${name ?? c.cluster_id}" variant.`,
    }
  })

  return { component: report.component, proposals }
}
