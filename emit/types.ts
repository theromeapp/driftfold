/**
 * Emitter types: the Opus "propose" output and the locked changeset shape.
 */

import type { ComponentReport } from "../cli/types.ts"

export type Decision = "snap-to" | "keep" | "rename" | "merge-into"

/** Opus's proposal for a single cluster (judgment layer). */
export interface ClusterProposal {
  cluster_id: string
  decision: Decision
  /** new/existing variant name, or another cluster_id when decision === "merge-into" */
  target_variant: string
  /** outlier that reads as a mistake rather than an intentional style */
  is_mistake: boolean
  /** one-line human-readable why */
  rationale: string
}

export interface ComponentProposal {
  component: string
  proposals: ClusterProposal[]
}

/** report + proposal for one component — the emitter's unit of work. */
export interface EmitItem {
  report: ComponentReport
  proposal: ComponentProposal
}

/** One cluster entry in changeset.json (matches CLAUDE.md locked schema). */
export interface ChangesetCluster {
  cluster_id: string
  decision: Decision
  target_variant: string
  folded_utils: string[]
  kept_utils: string[]
  call_sites: { file: string; line: number; variant: string | null; size: string | null }[]
}

export interface ChangesetComponent {
  component: string
  clusters: ChangesetCluster[]
}

export type Changeset = ChangesetComponent[]
