/**
 * Shared types for the DriftFold deterministic core.
 *
 * The CLI never runs the target app. Everything here is derived syntactically
 * (ts-morph) and merged through the app's `cn()` = `twMerge(clsx(...))` semantics.
 */

/** A parsed `cva()` definition (target (a)). */
export interface CvaDefinition {
  /** e.g. "buttonVariants" */
  exportName: string
  /** the cva base string (first cva() arg) */
  base: string
  /** variants[group][key] = class string, e.g. variants.variant.default */
  variants: Record<string, Record<string, string>>
  /** defaultVariants[group] = key */
  defaultVariants: Record<string, string>
  /** ordered group names as declared, e.g. ["variant","size"] */
  groups: string[]
  /** repo-relative source file the cva lives in */
  file: string
}

/** How a JSX `className` prop was authored. */
export type ClassNameValue =
  | { kind: "static"; value: string } // string literal — resolvable
  | { kind: "dynamic"; raw: string } // cn()/ternary/identifier — untouchable
  | { kind: "none" } // no className prop

/** A raw JSX usage of the component (target (b)), pre-clustering. */
export interface RawUsage {
  file: string
  line: number
  /** variant-group prop value per group; null = present-but-expression (unknown) */
  variantProps: Record<string, string | null>
  className: ClassNameValue
}

/** One call site inside a cluster (matches the locked changeset schema shape). */
export interface CallSite {
  file: string
  line: number
  /** value of the first variants group (or its default), e.g. "outline" */
  variant: string | null
  /** value of the second variants group (or its default), e.g. "lg" */
  size: string | null
  /** all variant-group props, for fidelity beyond variant/size */
  variant_props: Record<string, string | null>
  /** layout/contextual utilities partitioned out and kept at the call site */
  layout_utils: string[]
  /** the verbatim className string */
  raw_className: string
}

/** A drift cluster: usages whose appearance-override set is identical. */
export interface Cluster {
  cluster_id: string
  /** the cluster key: sorted, twMerge-normalized appearance utilities */
  appearance_utils: string[]
  site_count: number
  /** site_count === 1 — a one-off the human likely flags as a mistake */
  is_outlier: boolean
  call_sites: CallSite[]
}

/** Full deterministic report for one component. Input to the Opus propose step. */
export interface ComponentReport {
  component: string
  cva_export: string
  /** the cva base class string — used to render faithful swatches in the emitter */
  base: string
  /** existing variants the cva already defines — Opus maps clusters onto these */
  variant_inventory: Record<string, Record<string, string>>
  default_variants: Record<string, string>
  clusters: Cluster[]
  /** usages overridden only with layout utilities — no appearance drift */
  clean: { file: string; line: number; layout_utils: string[] }[]
  /** non-static classNames — excluded from clustering, cannot be safely refactored */
  dynamic: { file: string; line: number; raw: string }[]
  summary: {
    cluster_count: number
    drift_sites: number
    clean: number
    dynamic: number
  }
}
