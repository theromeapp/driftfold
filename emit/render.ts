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
// reads changes.
const DECISIONS: { value: string; label: string }[] = [
  { value: "snap-to", label: "✨ Save as a new reusable style" },
  { value: "merge-into", label: "🔗 It's a duplicate — combine it" },
  { value: "rename", label: "✏️ Keep, but give it a name" },
  { value: "keep", label: "✋ Leave this one alone" },
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

function clusterCard(
  report: ComponentReport,
  cluster: Cluster,
  proposal: ClusterProposal | undefined,
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
  const onceTag =
    cluster.site_count === 1 && !proposal?.is_mistake
      ? `<span class="df-tag df-tag-outlier">only here</span>`
      : ""
  const mistake = proposal?.is_mistake
    ? `<span class="df-tag df-tag-mistake">⚠ looks like a mistake</span>`
    : ""

  return `
  <div class="df-cluster" data-cluster="${cluster.cluster_id}">
    <div class="df-cluster-head">
      <span class="df-count">${usedIn}</span>
      ${onceTag}${mistake}
    </div>
    <div class="df-swatch">${swatch}</div>
    <p class="df-desc">${esc(description)}</p>
    <div class="df-proposal">
      <label>What should we do?</label>
      ${decisionSelect(proposal, cluster.cluster_id)}
      <input class="df-input" data-target="${cluster.cluster_id}"
             value="${esc(proposal?.target_variant ?? "")}" placeholder="name it, e.g. Primary" />
    </div>
    ${proposal?.rationale ? `<p class="df-why">${esc(proposal.rationale)}</p>` : ""}
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

  const cards = report.clusters
    .map((c) => clusterCard(report, c, proposalById.get(c.cluster_id)))
    .join("")

  const dyn = report.dynamic.length
    ? `<details class="df-dynamic"><summary>${report.dynamic.length} that change depending on context — we won't touch these</summary><ul>${report.dynamic
        .map((d) => `<li><code>${esc(d.file)}</code> <span class="df-ln">line ${d.line}</span></li>`)
        .join("")}</ul></details>`
    : ""

  const lookWord = report.summary.cluster_count === 1 ? "look" : "different looks"
  const placeWord = report.summary.drift_sites === 1 ? "place" : "places"
  return `
  <section class="df-component">
    <h2>${esc(report.component)} <span class="df-sub">${report.summary.cluster_count} ${lookWord} across ${report.summary.drift_sites} ${placeWord}</span></h2>
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
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         background:#0b0d12; color:#e7e9ee; }
  header { padding:28px 32px 16px; border-bottom:1px solid #1c2030; position:sticky; top:0;
           background:#0b0d12ee; backdrop-filter:blur(6px); z-index:20; }
  header h1 { margin:0; font-size:20px; letter-spacing:-.01em; }
  header .tag { color:#7c8295; font-weight:400; }
  header p { margin:6px 0 0; color:#9aa1b2; max-width:760px; }
  .stat { color:#5ed6a4; font-weight:600; }
  .how { margin:12px 0 0; display:flex; flex-wrap:wrap; gap:14px; align-items:baseline;
         font-size:12.5px; color:#aeb4c4; }
  .how b { color:#e7e9ee; }
  .how span { background:#11141d; border:1px solid #1f2435; border-radius:7px; padding:4px 9px; }
  .how em { color:#cdd3e1; font-style:normal; font-weight:600; }
  main { max-width:1180px; margin:0 auto; padding:24px 32px 240px; }
  .df-component { margin:36px 0; }
  .df-component h2 { font-size:17px; margin:0 0 14px; border-left:3px solid #3b82f6; padding-left:10px; }
  .df-sub { color:#7c8295; font-weight:400; font-size:13px; }
  .df-clean { color:#5ed6a4; font-weight:600; font-size:13px; }
  .df-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; }
  .df-cluster { background:#11141d; border:1px solid #1f2435; border-radius:12px; padding:14px; }
  .df-cluster-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
  .df-cid { font-family:ui-monospace,monospace; font-weight:700; color:#cdd3e1; }
  .df-count { color:#cdd3e1; font-size:13px; font-weight:600; }
  .df-tag { font-size:11px; padding:1px 7px; border-radius:999px; font-weight:600; }
  .df-tag-outlier { background:#3a2a12; color:#f0b765; }
  .df-tag-mistake { background:#3a1620; color:#f08aa6; }
  .df-swatch { background:#f4f4f5; border-radius:8px; padding:18px; display:flex;
               align-items:center; justify-content:center; min-height:64px; margin-bottom:10px; }
  .df-desc { margin:0 0 12px; font-size:13.5px; color:#dfe3ec; font-weight:500; }
  .df-chips-wrap { margin-top:10px; }
  .df-chips-wrap summary { cursor:pointer; color:#7c8295; font-size:12px; }
  .df-chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
  .df-chip { font-family:ui-monospace,monospace; font-size:11px; background:#1a1f2e;
             color:#9fb4e8; padding:2px 7px; border-radius:6px; }
  .df-proposal { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
  .df-proposal label { color:#cdd3e1; font-size:12.5px; font-weight:600; width:100%; }
  .df-select, .df-input { background:#0d1018; color:#e7e9ee; border:1px solid #2a3147;
             border-radius:7px; padding:6px 9px; font-size:13px; }
  .df-select { flex:1; min-width:200px; }
  .df-input { flex:1; min-width:120px; }
  .df-select:focus, .df-input:focus { outline:none; border-color:#3b82f6; }
  .df-why { color:#9aa1b2; font-size:12.5px; margin:10px 0 0; font-style:italic; }
  .df-sites { margin-top:10px; }
  .df-sites summary, .df-dynamic summary { cursor:pointer; color:#7c8295; font-size:12px; }
  .df-sites ul, .df-dynamic ul { margin:8px 0 0; padding-left:18px; }
  .df-sites li, .df-dynamic li { margin:3px 0; font-size:12px; color:#aeb4c4; }
  .df-sites code, .df-dynamic code { font-family:ui-monospace,monospace; color:#cdd3e1; }
  .df-ln { color:#6b7280; }
  .df-keep { color:#5e9c7e; }
  .df-dynamic { margin-top:14px; }
  .df-merge { border-color:#7c4dff !important; }
  /* live changeset dock */
  #dock { position:fixed; bottom:0; left:0; right:0; background:#0d1018f2; border-top:1px solid #1f2435;
          backdrop-filter:blur(8px); z-index:30; max-height:220px; overflow:auto; }
  #dock-bar { display:flex; align-items:center; gap:12px; padding:10px 32px; position:sticky; top:0;
              background:#0d1018f2; border-bottom:1px solid #161b29; }
  #dock-bar b { font-size:13px; } #dock-bar .hint { color:#7c8295; font-size:12px; }
  #dock pre { margin:0; padding:12px 32px 20px; font-family:ui-monospace,monospace; font-size:11.5px;
              color:#9fb4e8; white-space:pre; }
  button.df-act { margin-left:auto; }
  button.df-act, #copy { background:#3b82f6; color:#fff; border:0; border-radius:7px; padding:7px 14px;
          font-size:13px; font-weight:600; cursor:pointer; }
  #copy { margin-left:8px; background:#1f2435; }
  button.df-act:hover { background:#2f6ad9; }
</style>
</head>
<body>
<header>
  <h1>DriftFold <span class="tag">· what your buttons & cards actually look like</span></h1>
  <p>We scanned your app and found <span class="stat">${totalClusters}</span> slightly-different looks, used in <span class="stat">${totalSites}</span> places. Some are accidental copies of each other. Below, each card is one look — decide what to do with it, then download your choices at the bottom.</p>
  <div class="how">
    <b>How to use this:</b>
    <span>① Look at each style.</span>
    <span>② Pick an action from the dropdown.</span>
    <span>③ Hit <em>Download my choices</em> — that file tells DriftFold how to clean up the code.</span>
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
  function syncRow(el) {
    const id = el.getAttribute('data-decision') || el.getAttribute('data-target');
    const card = document.querySelector('[data-cluster="' + id + '"]');
    const dsel = document.querySelector('[data-decision="' + id + '"]');
    if (card && dsel) card.classList.toggle('df-merge', dsel.value === 'merge-into');
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
