/**
 * Render design-system.html — DriftFold's control surface.
 *
 * Self-contained, single file. Page chrome is plain inline CSS so the whole
 * surface (clusters, proposals, call sites, live changeset) works offline; only
 * the small live SWATCHES use the Tailwind Play CDN so the drift renders in real
 * pixels (incl. arbitrary values like bg-[#2563eb]).
 *
 * The page is interactive: change a cluster's decision/target and the
 * changeset.json preview updates live; Download writes the file the human hands
 * to Run 2.
 */

import { twMerge } from "tailwind-merge"

import type { Cluster, ComponentReport } from "../cli/types.ts"
import { utilityCore } from "../cli/classify.ts"
import type { ClusterProposal, EmitItem } from "./types.ts"
import { buildChangeset } from "./changeset.ts"

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Classes applied by the cva default variant selection (for faithful swatches). */
function defaultVariantClasses(report: ComponentReport): string {
  const parts: string[] = []
  for (const [group, key] of Object.entries(report.default_variants)) {
    const cls = report.variant_inventory[group]?.[key]
    if (cls) parts.push(cls)
  }
  return parts.join(" ")
}

/** The effective class for a drifted instance = base + default variant + override. */
function swatchClass(report: ComponentReport, appearanceUtils: string[]): string {
  return twMerge(
    [report.base, defaultVariantClasses(report), appearanceUtils.join(" ")]
      .filter(Boolean)
      .join(" "),
  )
}

function renderSwatch(component: string, classStr: string, label: string): string {
  const c = esc(classStr)
  const l = esc(label)
  if (component === "Card") {
    return `<div class="${c}" style="width:11rem"><div style="padding:1rem">${l}</div></div>`
  }
  if (component === "Badge") {
    return `<span class="${c}">${l}</span>`
  }
  if (component === "Button") {
    return `<button class="${c}" type="button">${l}</button>`
  }
  return `<div class="${c}">${l}</div>`
}

// Plain-English labels for each decision. The VALUE stays machine-readable
// (it's what changeset.json + the refactor step consume); only the text a human
// reads changes. Short verbs — the adaptive sentence under each control spells
// out exactly what the choice does.
const DECISIONS: { value: string; label: string }[] = [
  { value: "snap-to", label: "✨ Make this the main style" },
  { value: "merge-into", label: "🔁 Same as another — combine them" },
  { value: "keep", label: "✋ Leave it as-is" },
  { value: "rename", label: "✏️ Just give it a name" },
]

function decisionSelect(p: ClusterProposal | undefined, clusterId: string): string {
  const cur = p?.decision ?? "keep"
  const opts = DECISIONS.map(
    (d) =>
      `<option value="${d.value}"${d.value === cur ? " selected" : ""}>${d.label}</option>`,
  ).join("")
  return `<select class="df-select" data-decision="${clusterId}">${opts}</select>`
}

/** Translate one Tailwind class into a plain-English phrase (or null to skip). */
function humanizeToken(token: string): string | null {
  const core = utilityCore(token)
  const colorOf = (s: string): string | null => {
    if (s.startsWith("[")) return "a custom color"
    const m = s.match(/^([a-z]+)-\d+$/)
    if (m) return m[1] ?? null
    if (["white", "black"].includes(s)) return s
    return null
  }
  // background
  if (core === "bg-white" || core === "bg-black") return `${core.slice(3)} background`
  if (core.startsWith("bg-")) {
    const c = colorOf(core.slice(3))
    return c ? `${c} background` : "a background color"
  }
  // text color / size
  if (core.startsWith("text-")) {
    const rest = core.slice(5)
    if (["xs", "sm"].includes(rest)) return "small text"
    if (["lg", "xl", "2xl", "3xl"].includes(rest)) return "large text"
    const c = colorOf(rest) ?? (["white", "black"].includes(rest) ? rest : null)
    return c ? `${c} text` : null
  }
  if (core.startsWith("border-")) {
    const c = colorOf(core.slice(7))
    return c ? `${c} border` : "a colored border"
  }
  // corners
  if (core === "rounded-full") return "pill-shaped"
  if (core === "rounded-none") return "square corners"
  if (core.startsWith("rounded")) return "rounded corners"
  // shadow
  if (core === "shadow-2xl") return "a heavy shadow"
  if (core === "shadow-none") return "no shadow"
  if (core.startsWith("shadow")) return "a drop shadow"
  // misc appearance
  if (core.startsWith("font-")) return "bold text"
  if (/^p[xytrbl]?-/.test(core)) return "extra padding"
  if (core.startsWith("opacity-")) return "see-through"
  if (core.startsWith("ring")) return "a focus ring"
  return null
}

/** A plain-English one-liner describing a cluster's look. */
function humanize(utils: string[]): string {
  const seen = new Set<string>()
  const phrases: string[] = []
  for (const u of utils) {
    const p = humanizeToken(u)
    if (p && !seen.has(p)) {
      seen.add(p)
      phrases.push(p)
    }
  }
  if (phrases.length === 0) return "a custom look"
  const joined =
    phrases.length === 1
      ? phrases[0]!
      : phrases.slice(0, -1).join(", ") + " and " + phrases[phrases.length - 1]
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}

/**
 * The de-facto primary = the look a dev reaches for most. We crown the cluster
 * with the strict-max call-site count (>1 site, not flagged as a mistake). On a
 * tie there's no clear primary, so we crown nobody. The narrative: you THINK
 * your primary is the cva default, but you keep hand-writing THIS — so name it.
 */
function primaryClusterId(
  report: ComponentReport,
  proposalById: Map<string, ClusterProposal>,
): string | null {
  let best: Cluster | null = null
  for (const c of report.clusters) {
    if (c.site_count <= 1 || proposalById.get(c.cluster_id)?.is_mistake) continue
    if (!best || c.site_count > best.site_count) best = c
  }
  if (!best) return null
  const tie = report.clusters.some(
    (c) =>
      c !== best &&
      c.site_count === best!.site_count &&
      !proposalById.get(c.cluster_id)?.is_mistake,
  )
  return tie ? null : best.cluster_id
}

function clusterCard(
  report: ComponentReport,
  cluster: Cluster,
  proposal: ClusterProposal | undefined,
  isPrimary: boolean,
): string {
  const label = proposal?.target_variant || report.component
  const swatch = renderSwatch(
    report.component,
    swatchClass(report, cluster.appearance_utils),
    label,
  )
  const chips = cluster.appearance_utils
    .map((u) => `<code class="df-chip">${esc(u)}</code>`)
    .join("")
  const sites = cluster.call_sites
    .map((s) => {
      const keep = s.layout_utils.length
        ? ` <span class="df-keep">+ position kept (${esc(s.layout_utils.join(" "))})</span>`
        : ""
      return `<li><code>${esc(s.file)}</code> <span class="df-ln">line ${s.line}</span>${keep}</li>`
    })
    .join("")

  const description = humanize(cluster.appearance_utils)
  const usedIn = `Used in ${cluster.site_count} place${cluster.site_count === 1 ? "" : "s"}`
  const primaryTag = isPrimary
    ? `<span class="df-tag df-tag-primary">★ your main one</span>`
    : ""
  const onceTag =
    cluster.site_count === 1 && !proposal?.is_mistake
      ? `<span class="df-tag df-tag-outlier">only here</span>`
      : ""
  const mistake = proposal?.is_mistake
    ? `<span class="df-tag df-tag-mistake">⚠ looks like a mistake</span>`
    : ""

  return `
  <div class="df-cluster${isPrimary ? " df-primary" : ""}" data-cluster="${cluster.cluster_id}">
    <div class="df-cluster-head">
      <span class="df-count">${usedIn}</span>
      ${primaryTag}${onceTag}${mistake}
    </div>
    <div class="df-swatch">${swatch}</div>
    <p class="df-desc">${esc(description)}</p>
    <div class="df-proposal">
      <label>What should we do?</label>
      ${decisionSelect(proposal, cluster.cluster_id)}
      <input class="df-input" data-target="${cluster.cluster_id}"
             value="${esc(proposal?.target_variant ?? "")}" placeholder="name it, e.g. Primary" />
    </div>
    <p class="df-plain" data-plain="${cluster.cluster_id}"></p>
    ${proposal?.rationale ? `<details class="df-why-wrap"><summary>Why?</summary><p class="df-why">${esc(proposal.rationale)}</p></details>` : ""}
    <details class="df-sites"><summary>Show where it's used (${cluster.site_count})</summary>
      <ul>${sites}</ul>
    </details>
    <details class="df-chips-wrap"><summary>Exact code</summary>
      <div class="df-chips">${chips}</div>
    </details>
  </div>`
}

function componentSection(item: EmitItem): string {
  const { report, proposal } = item
  const proposalById = new Map(proposal.proposals.map((p) => [p.cluster_id, p]))

  if (report.clusters.length === 0) {
    return `
    <section class="df-component">
      <h2>${esc(report.component)} <span class="df-clean">✓ already consistent</span></h2>
      <p class="df-sub">Every ${esc(report.component)} uses the standard style — nothing to clean up here.</p>
    </section>`
  }

  const primaryId = primaryClusterId(report, proposalById)
  const cards = report.clusters
    .map((c) => clusterCard(report, c, proposalById.get(c.cluster_id), c.cluster_id === primaryId))
    .join("")

  const dyn = report.dynamic.length
    ? `<details class="df-dynamic"><summary>${report.dynamic.length} that change depending on context — we won't touch these</summary><ul>${report.dynamic
        .map((d) => `<li><code>${esc(d.file)}</code> <span class="df-ln">line ${d.line}</span></li>`)
        .join("")}</ul></details>`
    : ""

  const n = report.summary.cluster_count
  const sites = report.summary.drift_sites
  const placeWord = sites === 1 ? "place" : "places"
  let sub: string
  if (primaryId && n > 1) {
    const others = n - 1
    sub = `your main one + ${others} that look a bit different, across ${sites} ${placeWord}`
  } else if (n === 1) {
    sub = `1 look across ${sites} ${placeWord}`
  } else {
    sub = `${n} different looks across ${sites} ${placeWord}`
  }
  return `
  <section class="df-component">
    <h2>${esc(report.component)} <span class="df-sub">${sub}</span></h2>
    <div class="df-grid">${cards}</div>
    ${dyn}
  </section>`
}

export function renderDesignSystemHtml(items: EmitItem[]): string {
  const totalClusters = items.reduce((n, i) => n + i.report.clusters.length, 0)
  const totalSites = items.reduce((n, i) => n + i.report.summary.drift_sites, 0)
  const sections = items.map(componentSection).join("")

  // Embedded model for live changeset generation in the browser.
  const model = buildChangeset(items).map((c) => ({
    component: c.component,
    clusters: c.clusters.map((cl) => ({
      cluster_id: cl.cluster_id,
      folded_utils: cl.folded_utils,
      kept_utils: cl.kept_utils,
      call_sites: cl.call_sites,
    })),
  }))
  const initial = JSON.stringify(buildChangeset(items), null, 2)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>DriftFold — design-system.html</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    color-scheme: light;
    /* warm paper canvas — a design studio, not a terminal */
    --paper:#f4f1e9; --paper-2:#ece7db; --card:#fffdf8; --card-2:#fbf8f1;
    --ink:#23211c; --ink-2:#605a4e; --ink-3:#938c7c; --ink-4:#b6ae9c;
    --line:#e6e0d2; --line-soft:#efe9dc; --line-strong:#dcd4c2;
    --accent:#3257d6; --accent-deep:#2542b0; --accent-wash:#eaeefb; --accent-line:#cdd6f6;
    --violet:#7c50c8; --violet-wash:#f0e9fa; --violet-line:#dcccf1;
    --ochre:#b3812a; --ochre-wash:#f6edd6; --ochre-line:#e6d4a6;
    --rose:#c0405f; --rose-wash:#f9e6ea; --rose-line:#eecdd5;
    --green:#3a8f63;
    /* warm, layered shadows tuned for paper (base = rgb 38,32,20) */
    --sh-1:0 1px 2px rgba(38,32,20,.05), 0 1px 1px rgba(38,32,20,.04);
    --sh-card:0 1px 1px rgba(38,32,20,.04), 0 4px 10px -4px rgba(38,32,20,.07), 0 14px 30px -16px rgba(38,32,20,.12);
    --sh-hover:0 2px 4px rgba(38,32,20,.05), 0 10px 22px -8px rgba(38,32,20,.11), 0 26px 48px -20px rgba(38,32,20,.18);
    --sans:'Hanken Grotesk',ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
    --display:'Fraunces',Georgia,serif;
  }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.55 var(--sans); color:var(--ink); background:var(--paper);
         background-image:
           radial-gradient(1100px 520px at 8% -10%, rgba(50,87,214,.06), transparent 60%),
           radial-gradient(820px 460px at 96% -6%, rgba(179,129,42,.07), transparent 62%);
         background-attachment:fixed; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
  ::selection { background:var(--accent-wash); }
  header { padding:30px 32px 20px; border-bottom:1px solid var(--line-soft); position:sticky; top:0;
           background:rgba(244,241,233,.78); backdrop-filter:blur(14px) saturate(1.2);
           -webkit-backdrop-filter:blur(14px) saturate(1.2); z-index:20;
           box-shadow:0 1px 0 rgba(255,255,255,.6) inset, 0 10px 30px -24px rgba(38,32,20,.5); }
  header h1 { margin:0; font-family:var(--display); font-weight:600; font-size:31px; letter-spacing:-.025em;
              color:var(--ink); text-wrap:balance; }
  header h1 .mark { color:var(--accent); }
  header h1 .tag { font-family:var(--sans); font-size:13.5px; font-weight:450; letter-spacing:0; color:var(--ink-3); }
  header p { margin:11px 0 0; color:var(--ink-2); max-width:760px; font-size:14.5px; text-wrap:pretty; }
  .stat { color:var(--accent); font-weight:700; font-variant-numeric:tabular-nums; }
  .how { margin:16px 0 0; display:flex; flex-wrap:wrap; gap:8px; align-items:center;
         font-size:12.5px; color:var(--ink-2); }
  .how b { color:var(--ink); margin-right:4px; font-weight:600; }
  .how span { background:var(--card); border:1px solid var(--line); border-radius:9px; padding:6px 11px;
              box-shadow:var(--sh-1); }
  .how em { color:var(--accent); font-style:normal; font-weight:600; }
  main { max-width:1200px; margin:0 auto; padding:32px 32px 260px; }
  .df-component { margin:46px 0; }
  .df-component:first-child { margin-top:28px; }
  .df-component h2 { font-family:var(--display); font-weight:600; font-size:24px; letter-spacing:-.02em;
                     margin:0 0 18px; display:flex; align-items:baseline; gap:12px; color:var(--ink); text-wrap:balance; }
  .df-sub { color:var(--ink-3); font-weight:450; font-size:13px; font-family:var(--sans); letter-spacing:0; }
  .df-clean { color:var(--green); font-weight:600; font-size:13px; font-family:var(--sans); }
  .df-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(312px,1fr)); gap:18px; }
  .df-cluster { position:relative; border-radius:18px; padding:18px;
                background:var(--card); border:1px solid var(--line); box-shadow:var(--sh-card);
                transition:transform .18s cubic-bezier(.2,.7,.2,1), border-color .18s ease, box-shadow .18s ease; }
  .df-cluster:hover { transform:translateY(-3px); border-color:var(--line-strong); box-shadow:var(--sh-hover); }
  .df-cluster-head { display:flex; align-items:center; gap:8px; margin-bottom:13px; }
  .df-cid { font-family:var(--mono); font-weight:600; color:var(--ink-2); }
  .df-count { color:var(--ink); font-size:13px; font-weight:600; letter-spacing:-.01em; font-variant-numeric:tabular-nums; }
  .df-tag { font-size:10.5px; padding:3px 9px; border-radius:999px; font-weight:600; letter-spacing:.01em;
            border:1px solid transparent; }
  .df-tag-primary { background:var(--accent); color:#fff; border-color:transparent;
            box-shadow:0 1px 2px rgba(50,87,214,.4); }
  .df-tag-outlier { background:var(--ochre-wash); color:var(--ochre); border-color:var(--ochre-line); }
  .df-tag-mistake { background:var(--rose-wash); color:var(--rose); border-color:var(--rose-line); }
  .df-swatch { background:var(--paper-2); border-radius:13px; padding:22px;
               display:flex; align-items:center; justify-content:center; min-height:72px; margin-bottom:14px;
               outline:1px solid rgba(0,0,0,.06); outline-offset:-1px;
               box-shadow:0 1px 2px rgba(38,32,20,.05) inset; }
  .df-desc { margin:0 0 14px; font-size:14px; color:var(--ink); font-weight:500; letter-spacing:-.005em; text-wrap:pretty; }
  .df-chips-wrap { margin-top:12px; }
  .df-chips-wrap summary, .df-sites summary, .df-dynamic summary { cursor:pointer; color:var(--ink-3);
            font-size:12px; transition:color .12s ease; }
  .df-chips-wrap summary:hover, .df-sites summary:hover, .df-dynamic summary:hover { color:var(--accent); }
  .df-chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:10px; }
  .df-chip { font-family:var(--mono); font-size:11px; background:var(--accent-wash);
             color:var(--accent-deep); padding:3px 7px; border-radius:7px; border:1px solid var(--accent-line); }
  .df-proposal { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .df-proposal label { color:var(--ink-3); font-size:11px; font-weight:600; width:100%; text-transform:uppercase;
                       letter-spacing:.07em; margin-bottom:3px; }
  .df-select, .df-input { background:var(--card-2); color:var(--ink); border:1px solid var(--line-strong);
             border-radius:10px; padding:9px 11px; font-size:13px; font-family:var(--sans); box-shadow:var(--sh-1);
             transition:border-color .14s ease, box-shadow .14s ease, background-color .14s ease; }
  .df-select { flex:1; min-width:200px; font-weight:500; cursor:pointer; }
  .df-input { flex:1; min-width:120px; }
  .df-select:hover, .df-input:hover:not(:disabled) { border-color:var(--ink-4); }
  .df-select:focus, .df-input:focus { outline:none; border-color:var(--accent); background:var(--card);
             box-shadow:0 0 0 3px var(--accent-wash); }
  .df-input:disabled { cursor:not-allowed; }
  /* the adaptive plain-English sentence — the line a human actually reads to know what their pick does */
  .df-plain { margin:13px 0 0; padding:11px 13px; font-size:13.5px; line-height:1.5; color:var(--ink); font-weight:500;
              background:var(--accent-wash); border:1px solid var(--accent-line); border-left:3px solid var(--accent);
              border-radius:11px; text-wrap:pretty; }
  .df-merge .df-plain { background:var(--violet-wash); border-color:var(--violet-line); border-left-color:var(--violet); }
  .df-why-wrap { margin-top:10px; }
  .df-why-wrap summary { cursor:pointer; color:var(--ink-3); font-size:12px; list-style:none; transition:color .12s ease; }
  .df-why-wrap summary:hover { color:var(--accent); }
  .df-why-wrap summary::-webkit-details-marker { display:none; }
  .df-why-wrap summary::before { content:"ⓘ "; color:var(--ink-4); }
  .df-why { color:var(--ink-2); font-size:12.5px; margin:9px 0 0; font-style:italic; text-wrap:pretty; }
  .df-sites { margin-top:12px; }
  .df-sites ul, .df-dynamic ul { margin:10px 0 0; padding-left:18px; }
  .df-sites li, .df-dynamic li { margin:5px 0; font-size:12px; color:var(--ink-2); }
  .df-sites code, .df-dynamic code { font-family:var(--mono); color:var(--ink-2); }
  .df-ln { color:var(--ink-3); font-variant-numeric:tabular-nums; }
  .df-keep { color:var(--green); }
  .df-dynamic { margin-top:18px; }
  .df-merge { border-color:var(--violet-line) !important;
              box-shadow:0 0 0 1px var(--violet-line), 0 14px 30px -16px rgba(124,80,200,.4) !important; }
  /* the de-facto primary gets a calm cobalt ring so it reads as the hero of the set */
  .df-primary { border-color:var(--accent-line);
              box-shadow:0 0 0 1.5px var(--accent-line), var(--sh-card); }
  .df-primary:hover { border-color:var(--accent);
              box-shadow:0 0 0 1.5px var(--accent), var(--sh-hover); }
  /* live changeset dock — a calm light "review tray", not a terminal */
  #dock { position:fixed; bottom:0; left:0; right:0; background:rgba(248,246,240,.9); border-top:1px solid var(--line);
          backdrop-filter:blur(16px) saturate(1.2); -webkit-backdrop-filter:blur(16px) saturate(1.2);
          z-index:30; max-height:236px; overflow:auto; box-shadow:0 -12px 36px -26px rgba(38,32,20,.55); }
  #dock-bar { display:flex; align-items:center; gap:12px; padding:13px 32px; position:sticky; top:0;
              background:rgba(248,246,240,.96); border-bottom:1px solid var(--line-soft); }
  #dock-bar b { font-size:13px; font-weight:600; color:var(--ink); }
  #dock-bar .hint { color:var(--ink-3); font-size:12px; }
  #dock pre { margin:0; padding:14px 32px 24px; font-family:var(--mono); font-size:11.5px;
              color:var(--ink-2); white-space:pre; }
  button.df-act { margin-left:auto; }
  button.df-act { background:var(--accent); color:#fff; border:0;
          border-radius:10px; padding:9px 16px; font-size:13px; font-weight:600; cursor:pointer; font-family:var(--sans);
          box-shadow:0 1px 1px rgba(38,32,20,.1), 0 8px 18px -8px rgba(50,87,214,.6);
          transition:transform .1s cubic-bezier(.2,.7,.2,1), background-color .15s ease, box-shadow .15s ease; }
  #copy { margin-left:8px; background:var(--card); color:var(--ink-2); border:1px solid var(--line-strong);
          border-radius:10px; padding:9px 15px; font-size:13px; font-weight:600; cursor:pointer; font-family:var(--sans);
          box-shadow:var(--sh-1); transition:transform .1s cubic-bezier(.2,.7,.2,1), border-color .15s ease, color .15s ease; }
  button.df-act:hover { background:var(--accent-deep); transform:translateY(-1px); }
  button.df-act:active { transform:scale(.96); }
  #copy:hover { border-color:var(--ink-4); color:var(--ink); }
  #copy:active { transform:scale(.96); }
  /* one orchestrated page-load cascade — softer than a wall of motion, off for reduced-motion */
  @media (prefers-reduced-motion: no-preference) {
    @keyframes dfRise { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
    header h1, header p, header .how { animation:dfRise .55s cubic-bezier(.2,.7,.2,1) both; }
    header p { animation-delay:.06s; } header .how { animation-delay:.12s; }
    .df-component { animation:dfRise .6s cubic-bezier(.2,.7,.2,1) both; }
    .df-grid > .df-cluster { animation:dfRise .55s cubic-bezier(.2,.7,.2,1) both; }
    .df-grid > .df-cluster:nth-child(1) { animation-delay:.02s; }
    .df-grid > .df-cluster:nth-child(2) { animation-delay:.07s; }
    .df-grid > .df-cluster:nth-child(3) { animation-delay:.12s; }
    .df-grid > .df-cluster:nth-child(4) { animation-delay:.17s; }
    .df-grid > .df-cluster:nth-child(5) { animation-delay:.22s; }
    .df-grid > .df-cluster:nth-child(6) { animation-delay:.27s; }
    .df-grid > .df-cluster:nth-child(n+7) { animation-delay:.3s; }
  }
</style>
</head>
<body>
<header>
  <h1>Drift<span class="mark">Fold</span> <span class="tag">· what your buttons &amp; cards actually look like</span></h1>
  <p>We looked through your app and found <span class="stat">${totalClusters}</span> button and card styles that don't quite match, used across <span class="stat">${totalSites}</span> spots. A lot of them are really the same thing twice. Each card below is one style — just tell us what to do with it, then download your choices at the bottom.</p>
  <div class="how">
    <b>How it works:</b>
    <span>① Look at each style.</span>
    <span>② Tell us what to do with it.</span>
    <span>③ Hit <em>Download my choices</em> — that's the file that cleans things up.</span>
  </div>
</header>
<main>${sections}</main>

<div id="dock">
  <div id="dock-bar">
    <b>Your choices</b>
    <span class="hint">updates as you pick — this is what gets cleaned up</span>
    <button class="df-act" id="download">⬇ Download my choices</button>
    <button id="copy">Copy</button>
  </div>
  <pre id="changeset">${esc(initial)}</pre>
</div>

<script>
  const MODEL = ${JSON.stringify(model)};
  // cluster_id -> { component, count } for the adaptive plain-English sentence.
  const META = {};
  MODEL.forEach(function(comp) {
    comp.clusters.forEach(function(cl) {
      META[cl.cluster_id] = { component: comp.component, count: cl.call_sites.length };
    });
  });
  function buildChangeset() {
    return MODEL.map(function(comp) {
      return {
        component: comp.component,
        clusters: comp.clusters.map(function(cl) {
          const dsel = document.querySelector('[data-decision="' + cl.cluster_id + '"]');
          const tinp = document.querySelector('[data-target="' + cl.cluster_id + '"]');
          return {
            cluster_id: cl.cluster_id,
            decision: dsel ? dsel.value : 'keep',
            target_variant: tinp ? tinp.value : '',
            folded_utils: cl.folded_utils,
            kept_utils: cl.kept_utils,
            call_sites: cl.call_sites
          };
        })
      };
    });
  }
  function refresh() {
    document.getElementById('changeset').textContent = JSON.stringify(buildChangeset(), null, 2);
  }
  function plainSentence(id, decision, target) {
    const m = META[id] || { component: 'element', count: 0 };
    const here = m.count + ' place' + (m.count === 1 ? '' : 's');
    const name = (target || '').trim();
    if (decision === 'snap-to')
      return name
        ? 'Make this the “' + name + '” style and use it in all ' + here + '.'
        : 'Make this its own style — give it a name on the right.';
    if (decision === 'merge-into')
      return name
        ? 'These are the same as “' + name + '” — switch all ' + here + ' to use it.'
        : 'These look like copies — type the style they should use instead.';
    if (decision === 'rename')
      return name ? 'Just rename this style to “' + name + '”.' : 'Keep it as-is, but give it a name on the right.';
    return 'Leave these ' + here + ' exactly as they are.';
  }
  function syncRow(el) {
    const id = el.getAttribute('data-decision') || el.getAttribute('data-target');
    const card = document.querySelector('[data-cluster="' + id + '"]');
    const dsel = document.querySelector('[data-decision="' + id + '"]');
    const tinp = document.querySelector('[data-target="' + id + '"]');
    const plain = document.querySelector('[data-plain="' + id + '"]');
    if (!dsel) return;
    const decision = dsel.value;
    if (card) card.classList.toggle('df-merge', decision === 'merge-into');
    if (tinp) {
      const off = decision === 'keep';
      tinp.disabled = off;
      tinp.style.opacity = off ? '0.35' : '1';
      tinp.placeholder =
        decision === 'merge-into' ? 'which style?… e.g. destructive' : 'name it… e.g. Primary';
    }
    if (plain) plain.textContent = plainSentence(id, decision, tinp ? tinp.value : '');
  }
  document.querySelectorAll('[data-decision],[data-target]').forEach(function(el) {
    el.addEventListener('input', function() { syncRow(el); refresh(); });
    syncRow(el);
  });
  document.getElementById('download').addEventListener('click', function() {
    const blob = new Blob([JSON.stringify(buildChangeset(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'changeset.json';
    a.click();
  });
  document.getElementById('copy').addEventListener('click', function() {
    navigator.clipboard.writeText(JSON.stringify(buildChangeset(), null, 2));
  });
  refresh();
</script>
</body>
</html>`
}
