/**
 * Resolve → cluster → partition. The deterministic heart of DriftFold.
 *
 * For each static-className usage:
 *   1. tokenize the override
 *   2. partition appearance (fold) vs layout (keep)
 *   3. layout-only           → "clean" (no drift)
 *      has appearance utils  → drift; cluster key = sorted twMerge(appearance set)
 *   dynamic className         → "dynamic" (untouchable)
 *
 * Clustering merges through the app's cn() semantics: tokens that differ only in
 * order (or carry a redundant intra-conflict) collapse to one cluster. Arbitrary
 * values (`bg-[#2563eb]`) stay a SEPARATE cluster by design — the human merges
 * those in the annotation layer.
 */

import { twMerge } from "tailwind-merge"

import type { Cluster, ComponentReport, CvaDefinition, RawUsage } from "./types.ts"
import { partition } from "./classify.ts"

/** Short, stable cluster-id prefix per component. */
function idPrefix(component: string): string {
  const map: Record<string, string> = {
    Button: "btn",
    Card: "card",
    Badge: "badge",
    Input: "input",
  }
  return map[component] ?? component.toLowerCase().slice(0, 4)
}

/**
 * Cluster key for an appearance-override set: twMerge collapses internal
 * conflicts/dupes, then sort makes it order-independent.
 */
function appearanceKey(appearanceTokens: string[]): string[] {
  if (appearanceTokens.length === 0) return []
  const merged = twMerge(appearanceTokens.join(" ")).split(/\s+/).filter(Boolean)
  return [...new Set(merged)].sort()
}

export function buildReport(
  component: string,
  def: CvaDefinition,
  usages: RawUsage[],
): ComponentReport {
  const groups = def.groups
  const primary = groups[0]
  const secondary = groups[1]

  const clean: ComponentReport["clean"] = []
  const dynamic: ComponentReport["dynamic"] = []

  // key -> accumulating cluster
  const byKey = new Map<
    string,
    { appearance_utils: string[]; call_sites: Cluster["call_sites"] }
  >()

  for (const u of usages) {
    if (u.className.kind === "none") continue
    if (u.className.kind === "dynamic") {
      dynamic.push({ file: u.file, line: u.line, raw: u.className.raw })
      continue
    }

    const tokens = u.className.value.split(/\s+/).filter(Boolean)
    const { appearance, layout } = partition(tokens)

    if (appearance.length === 0) {
      clean.push({ file: u.file, line: u.line, layout_utils: layout })
      continue
    }

    const key = appearanceKey(appearance)
    const keyStr = key.join(" ")
    const callSite = {
      file: u.file,
      line: u.line,
      variant: primary ? u.variantProps[primary] ?? null : null,
      size: secondary ? u.variantProps[secondary] ?? null : null,
      variant_props: u.variantProps,
      layout_utils: layout,
      raw_className: u.className.value,
    }
    const existing = byKey.get(keyStr)
    if (existing) existing.call_sites.push(callSite)
    else byKey.set(keyStr, { appearance_utils: key, call_sites: [callSite] })
  }

  // Deterministic cluster order: most-used first, then key alphabetically.
  const entries = [...byKey.values()].sort((a, b) => {
    if (b.call_sites.length !== a.call_sites.length)
      return b.call_sites.length - a.call_sites.length
    return a.appearance_utils.join(" ") < b.appearance_utils.join(" ") ? -1 : 1
  })

  const prefix = idPrefix(component)
  const clusters: Cluster[] = entries.map((e, i) => ({
    cluster_id: `${prefix}-${i + 1}`,
    appearance_utils: e.appearance_utils,
    site_count: e.call_sites.length,
    is_outlier: e.call_sites.length === 1,
    call_sites: e.call_sites,
  }))

  const driftSites = clusters.reduce((n, c) => n + c.site_count, 0)

  return {
    component,
    cva_export: def.exportName,
    variant_inventory: def.variants,
    default_variants: def.defaultVariants,
    clusters,
    clean,
    dynamic,
    summary: {
      cluster_count: clusters.length,
      drift_sites: driftSites,
      clean: clean.length,
      dynamic: dynamic.length,
    },
  }
}
