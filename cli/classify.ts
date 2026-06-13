/**
 * Deterministic Tailwind utility classifier: appearance vs layout.
 *
 * DriftFold folds *appearance* utilities (color, radius, shadow, padding, type)
 * into cva variants, and *keeps* layout/contextual utilities (margin, sizing,
 * positioning, grid/flex placement) at the call site. See CLAUDE.md "Scope lock".
 *
 * Strategy: an explicit appearance allowlist by property group; everything else
 * (and any unknown token) defaults to LAYOUT/keep. Defaulting unknowns to "keep"
 * is the conservative choice — DriftFold never proposes folding a utility it does
 * not understand.
 */

/**
 * Strip responsive/state modifiers (`hover:`, `md:`, `dark:`, `data-[...]:`) and
 * the `!` important flag to get the utility core, bracket-aware so arbitrary
 * values like `bg-[#2563eb]` are not split on their internal characters.
 */
export function utilityCore(token: string): string {
  let depth = 0
  let lastColon = -1
  for (let i = 0; i < token.length; i++) {
    const c = token[i]
    if (c === "[") depth++
    else if (c === "]") depth--
    else if (c === ":" && depth === 0) lastColon = i
  }
  let core = lastColon === -1 ? token : token.slice(lastColon + 1)
  if (core.startsWith("!")) core = core.slice(1)
  if (core.startsWith("-")) core = core.slice(1) // negative utilities (-mt-2)
  return core
}

// `text-*` tokens that are NOT color/size/weight (appearance) but flow/overflow
// (layout). These control geometry — folding them into a shared variant would
// force wrapping/truncation onto every consumer. Keep them at the call site.
const TEXT_LAYOUT = new Set([
  "left",
  "center",
  "right",
  "justify",
  "start",
  "end", // alignment
  "wrap",
  "nowrap",
  "balance",
  "pretty", // text-wrap
  "ellipsis",
  "clip", // text-overflow
])
const BORDER_LAYOUT = new Set(["collapse", "separate"]) // border-collapse / border-separate

// NOTE on scope: the appearance fold-list below is deliberately limited to the
// four families the scope lock names — color, radius, shadow, padding (+ their
// close cousins: gradients, ring, opacity, type, decoration). Visual-but-
// out-of-scope namespaces (transition-*, animate-*, cursor-*, filter/backdrop-*,
// transform-*) fall through to "layout" ON PURPOSE: DriftFold keeps them at the
// call site rather than folding utilities it isn't scoped to reason about. That
// is correct for THIS tool, not an oversight — see CLAUDE.md "Scope lock".

/** Appearance property-group prefixes (the fold list). */
const APPEARANCE_PREFIXES = [
  "bg-",
  "from-",
  "via-",
  "to-",
  "rounded", // rounded, rounded-*
  "shadow", // shadow, shadow-*
  "ring", // ring, ring-*
  "opacity-",
  "font-",
  "tracking-",
  "leading-",
  "decoration-",
  "divide-",
  "outline-",
  "accent-",
  "fill-",
  "stroke-",
  "placeholder-",
  "caret-",
  // padding (scope lock explicitly folds padding)
  "p-",
  "px-",
  "py-",
  "pt-",
  "pr-",
  "pb-",
  "pl-",
  "ps-",
  "pe-",
]

/** Classify a single Tailwind class token. */
export function classify(token: string): "appearance" | "layout" {
  const core = utilityCore(token)

  // text-*: alignment + flow/overflow is layout; color/size/weight is appearance.
  if (core.startsWith("text-")) {
    const rest = core.slice("text-".length)
    return TEXT_LAYOUT.has(rest) ? "layout" : "appearance"
  }

  // border / border-*: most border-* is color/width (appearance); a few are table layout.
  if (core === "border" || core.startsWith("border-")) {
    const rest = core === "border" ? "" : core.slice("border-".length)
    if (BORDER_LAYOUT.has(rest) || rest.startsWith("spacing")) return "layout"
    return "appearance"
  }

  for (const p of APPEARANCE_PREFIXES) {
    if (core === p.replace(/-$/, "") || core.startsWith(p)) return "appearance"
  }

  // Everything else — margin, w/h, min/max, grid/flex placement, position, z,
  // display, overflow, gap, space, etc. — is layout/contextual. Unknown → keep.
  return "layout"
}

/** Partition a className token list into appearance (fold) and layout (keep). */
export function partition(tokens: string[]): {
  appearance: string[]
  layout: string[]
} {
  const appearance: string[] = []
  const layout: string[] = []
  for (const t of tokens) {
    if (classify(t) === "appearance") appearance.push(t)
    else layout.push(t)
  }
  return { appearance, layout }
}
