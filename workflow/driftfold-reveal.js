export const meta = {
  name: 'driftfold-reveal',
  description:
    'Run 1: crawl shadcn/cva className drift, cluster it (deterministic CLI), have Opus propose canonical variants, emit design-system.html + changeset.json. Stops at the human-annotation gate.',
  phases: [
    { title: 'Discover + Propose', detail: 'per-component: CLI clusters drift → Opus proposes variants' },
    { title: 'Emit', detail: 'render design-system.html + pre-filled changeset.json' },
  ],
}

// ---------------------------------------------------------------------------
// Config (override via Workflow args: { repo, root, components })
// ---------------------------------------------------------------------------
const REPO = (args && args.repo) || '/Users/sahil/Development/driftfold'
const ROOT = (args && args.root) || 'fixture'
const COMPONENTS = (args && args.components) || ['Button', 'Card', 'Badge', 'Input']

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// What the discover stage returns — the exact output of
// `discover-cluster <C> --propose-input`. The agent is a pure transport: it runs
// the CLI and hands the JSON back unmodified. Clustering is NOT the agent's job.
const PROPOSE_INPUT_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    component: { type: 'string' },
    has_drift: { type: 'boolean' },
    existing_variants: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          group: { type: 'string' },
          name: { type: 'string' },
          classes: { type: 'string' },
        },
        required: ['group', 'name', 'classes'],
      },
    },
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          cluster_id: { type: 'string' },
          appearance_utils: { type: 'array', items: { type: 'string' } },
          site_count: { type: 'number' },
          is_outlier: { type: 'boolean' },
        },
        required: ['cluster_id', 'appearance_utils', 'site_count', 'is_outlier'],
      },
    },
  },
  required: ['component', 'has_drift', 'clusters'],
}

// Opus judgment per cluster.
const PROPOSAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    component: { type: 'string' },
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          cluster_id: { type: 'string' },
          decision: { type: 'string', enum: ['snap-to', 'keep', 'rename', 'merge-into'] },
          target_variant: { type: 'string' },
          is_mistake: { type: 'boolean' },
          rationale: { type: 'string' },
        },
        required: ['cluster_id', 'decision', 'target_variant', 'is_mistake', 'rationale'],
      },
    },
  },
  required: ['component', 'proposals'],
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function discoverPrompt(component) {
  return [
    `You are a deterministic transport step in the DriftFold workflow. You do NOT make judgments.`,
    ``,
    `Run exactly this command (it does the clustering deterministically):`,
    ``,
    `    cd ${REPO} && bun run cli/index.ts discover-cluster ${component} --root ${ROOT} --propose-input`,
    ``,
    `Return the command's stdout parsed as JSON, VERBATIM. Do not add, drop, rename,`,
    `reorder, or "improve" any field. If the command errors, return`,
    `{ "component": "${component}", "has_drift": false, "existing_variants": [], "clusters": [] }.`,
  ].join('\n')
}

function proposePrompt(input) {
  return [
    `You are the judgment step of DriftFold, run on Opus. A deterministic CLI has already`,
    `crawled a Tailwind + shadcn/cva codebase and clustered every \`className\` override on the`,
    `<${input.component}> component. Tokens that resolve to the same effective appearance (after`,
    `twMerge) are already in the same cluster. Your job is to decide what each cluster should`,
    `BECOME so the drift folds back into clean, canonical cva variants.`,
    ``,
    `The component's EXISTING cva variants (what's already defined):`,
    '```json',
    JSON.stringify(input.existing_variants, null, 2),
    '```',
    ``,
    `The drift CLUSTERS found at call sites (appearance utilities only — layout was stripped):`,
    '```json',
    JSON.stringify(input.clusters, null, 2),
    '```',
    ``,
    `For EACH cluster, choose exactly one decision:`,
    ``,
    `- "merge-into": this cluster is the SAME look as something that already exists. Set`,
    `  target_variant to either (a) an EXISTING variant name above when the hand-rolled classes`,
    `  duplicate it (e.g. a hand-rolled red == the "destructive" variant), or (b) ANOTHER`,
    `  cluster's cluster_id when two clusters are secretly identical. CRUCIAL: an arbitrary`,
    `  value like bg-[#2563eb] is the literal hex of bg-blue-600 — if another cluster uses the`,
    `  named color with the same other utilities, they render identical pixels: merge the`,
    `  arbitrary one INTO the named one (target_variant = that cluster's id).`,
    `- "snap-to": this is a genuinely NEW canonical look used in multiple places. Give it a`,
    `  short semantic variant name (target_variant), e.g. "primary", "success", "accent",`,
    `  "muted". Name by ROLE, not color.`,
    `- "rename": keep it as its own variant but the existing/auto name is wrong — give the`,
    `  better name in target_variant.`,
    `- "keep": leave it at the call site — a legitimate one-off or contextual style that should`,
    `  NOT become a shared variant.`,
    ``,
    `Set is_mistake=true when a cluster reads as an ERROR rather than a style — e.g. illegible`,
    `combinations (same-hue text on background), or a lone outlier that matches nothing and was`,
    `probably a copy-paste slip. Mistakes usually get decision "keep" (flag for human review).`,
    ``,
    `rationale: one crisp sentence a busy engineer would nod at. Reference the actual classes.`,
    ``,
    `Return a proposal for every cluster_id, in the same order. component must be "${input.component}".`,
  ].join('\n')
}

function emitPrompt(proposalsJson) {
  return [
    `You are the emit step of the DriftFold workflow.`,
    ``,
    `1. Use the Write tool to create the file ${REPO}/.driftfold-cache/proposals.json with`,
    `   EXACTLY this content (verbatim — do not reformat or edit):`,
    '```json',
    proposalsJson,
    '```',
    ``,
    `2. Then run exactly:`,
    ``,
    `    cd ${REPO} && bun run cli/index.ts emit --root ${ROOT} --proposals .driftfold-cache/proposals.json ${COMPONENTS.join(' ')}`,
    ``,
    `3. Return the command's stdout verbatim. This writes design-system.html + changeset.json`,
    `   into ${REPO}.`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

phase('Discover + Propose')

// Per-component pipeline: discover (CLI-backed transport) → propose (Opus judgment).
// No barrier between components (decision #4). A clean component (no drift) skips
// the Opus call and returns an empty proposal set.
const results = await pipeline(
  COMPONENTS,
  (component) =>
    agent(discoverPrompt(component), {
      label: `discover:${component}`,
      phase: 'Discover + Propose',
      schema: PROPOSE_INPUT_SCHEMA,
      agentType: 'general-purpose',
    }),
  (input, component) => {
    if (!input || !input.has_drift || !input.clusters || input.clusters.length === 0) {
      log(`${component}: clean — no appearance drift, nothing to propose`)
      return { component, proposals: [] }
    }
    return agent(proposePrompt(input), {
      label: `propose:${component}`,
      phase: 'Discover + Propose',
      schema: PROPOSAL_SCHEMA,
    })
  },
)

const proposals = results.filter(Boolean)
const totalClusters = proposals.reduce((n, p) => n + (p.proposals ? p.proposals.length : 0), 0)
log(`Opus proposed decisions for ${totalClusters} clusters across ${proposals.length} components`)

phase('Emit')

const emitResult = await agent(emitPrompt(JSON.stringify(proposals, null, 2)), {
  label: 'emit',
  phase: 'Emit',
  agentType: 'general-purpose',
})

log('Run 1 complete. Open design-system.html, annotate the clusters, then run Run 2 against changeset.json.')

return { proposals, emit: emitResult }
