/**
 * Build the changeset.json scaffold from reports + Opus proposals.
 *
 * Run 1 emits this pre-filled with Opus's proposed decisions. The human edits it
 * (in the HTML or by hand); Run 2 reads it back. It is the boundary between runs.
 */

import type { Changeset, ChangesetCluster, EmitItem } from "./types.ts"

export function buildChangeset(items: EmitItem[]): Changeset {
  return items
    .filter((it) => it.report.clusters.length > 0)
    .map((it) => {
      const proposalById = new Map(
        it.proposal.proposals.map((p) => [p.cluster_id, p]),
      )
      const clusters: ChangesetCluster[] = it.report.clusters.map((c) => {
        const p = proposalById.get(c.cluster_id)
        const kept = [...new Set(c.call_sites.flatMap((s) => s.layout_utils))].sort()
        return {
          cluster_id: c.cluster_id,
          decision: p?.decision ?? "keep",
          target_variant: p?.target_variant ?? "",
          folded_utils: c.appearance_utils,
          kept_utils: kept,
          call_sites: c.call_sites.map((s) => ({
            file: s.file,
            line: s.line,
            variant: s.variant,
            size: s.size,
          })),
        }
      })
      return { component: it.report.component, clusters }
    })
}
