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

const DECISIONS = ["snap-to", "keep", "rename", "merge-into"] as const

function decisionSelect(p: ClusterProposal | undefined, clusterId: string): string {
  const cur = p?.decision ?? "keep"
  const opts = DECISIONS.map(
    (d) => `<option value="${d}"${d === cur ? " selected" : ""}>${d}</option>`,
  ).join("")
  return `<select class="df-select" data-decision="${clusterId}">${opts}</select>`
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
        ? ` <span class="df-keep">keep ${esc(s.layout_utils.join(" "))}</span>`
        : ""
      const vs =
        s.variant || s.size
          ? ` <span class="df-vs">${esc(s.variant ?? "—")}/${esc(s.size ?? "—")}</span>`
          : ""
      return `<li><code>${esc(s.file)}:${s.line}</code>${vs}${keep}</li>`
    })
    .join("")

  const outlier = cluster.is_outlier
    ? `<span class="df-tag df-tag-outlier">outlier</span>`
    : ""
  const mistake = proposal?.is_mistake
    ? `<span class="df-tag df-tag-mistake">likely mistake</span>`
    : ""

  return `
  <div class="df-cluster" data-cluster="${cluster.cluster_id}">
    <div class="df-cluster-head">
      <span class="df-cid">${cluster.cluster_id}</span>
      <span class="df-count">×${cluster.site_count}</span>
      ${outlier}${mistake}
    </div>
    <div class="df-swatch">${swatch}</div>
    <div class="df-chips">${chips}</div>
    <div class="df-proposal">
      <label>fold as</label>
      ${decisionSelect(proposal, cluster.cluster_id)}
      <input class="df-input" data-target="${cluster.cluster_id}"
             value="${esc(proposal?.target_variant ?? "")}" placeholder="variant name / cluster" />
    </div>
    ${proposal?.rationale ? `<p class="df-why">${esc(proposal.rationale)}</p>` : ""}
    <details class="df-sites"><summary>${cluster.site_count} call site${cluster.site_count === 1 ? "" : "s"}</summary>
      <ul>${sites}</ul>
    </details>
  </div>`
}

function componentSection(item: EmitItem): string {
  const { report, proposal } = item
  const proposalById = new Map(proposal.proposals.map((p) => [p.cluster_id, p]))

  if (report.clusters.length === 0) {
    return `
    <section class="df-component">
      <h2>${esc(report.component)} <span class="df-clean">✓ clean — no appearance drift</span></h2>
      <p class="df-sub">${report.summary.clean} layout-only override${report.summary.clean === 1 ? "" : "s"}, nothing to fold.</p>
    </section>`
  }

  const cards = report.clusters
    .map((c) => clusterCard(report, c, proposalById.get(c.cluster_id)))
    .join("")

  const dyn = report.dynamic.length
    ? `<details class="df-dynamic"><summary>${report.dynamic.length} dynamic / untouchable (left as-is)</summary><ul>${report.dynamic
        .map((d) => `<li><code>${esc(d.file)}:${d.line}</code> <code class="df-raw">${esc(d.raw)}</code></li>`)
        .join("")}</ul></details>`
    : ""

  return `
  <section class="df-component">
    <h2>${esc(report.component)} <span class="df-sub">${report.summary.cluster_count} clusters · ${report.summary.drift_sites} drift sites</span></h2>
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
  header p { margin:6px 0 0; color:#9aa1b2; }
  .stat { color:#5ed6a4; font-weight:600; }
  main { max-width:1180px; margin:0 auto; padding:24px 32px 240px; }
  .df-component { margin:36px 0; }
  .df-component h2 { font-size:17px; margin:0 0 14px; border-left:3px solid #3b82f6; padding-left:10px; }
  .df-sub { color:#7c8295; font-weight:400; font-size:13px; }
  .df-clean { color:#5ed6a4; font-weight:600; font-size:13px; }
  .df-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; }
  .df-cluster { background:#11141d; border:1px solid #1f2435; border-radius:12px; padding:14px; }
  .df-cluster-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
  .df-cid { font-family:ui-monospace,monospace; font-weight:700; color:#cdd3e1; }
  .df-count { color:#7c8295; font-size:12px; }
  .df-tag { font-size:11px; padding:1px 7px; border-radius:999px; font-weight:600; }
  .df-tag-outlier { background:#3a2a12; color:#f0b765; }
  .df-tag-mistake { background:#3a1620; color:#f08aa6; }
  .df-swatch { background:#f4f4f5; border-radius:8px; padding:18px; display:flex;
               align-items:center; justify-content:center; min-height:64px; margin-bottom:10px; }
  .df-chips { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:12px; }
  .df-chip { font-family:ui-monospace,monospace; font-size:11px; background:#1a1f2e;
             color:#9fb4e8; padding:2px 7px; border-radius:6px; }
  .df-proposal { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
  .df-proposal label { color:#7c8295; font-size:12px; }
  .df-select, .df-input { background:#0d1018; color:#e7e9ee; border:1px solid #2a3147;
             border-radius:7px; padding:5px 8px; font-size:13px; }
  .df-input { flex:1; min-width:120px; font-family:ui-monospace,monospace; }
  .df-select:focus, .df-input:focus { outline:none; border-color:#3b82f6; }
  .df-why { color:#9aa1b2; font-size:12.5px; margin:10px 0 0; font-style:italic; }
  .df-sites { margin-top:10px; }
  .df-sites summary, .df-dynamic summary { cursor:pointer; color:#7c8295; font-size:12px; }
  .df-sites ul, .df-dynamic ul { margin:8px 0 0; padding-left:18px; }
  .df-sites li, .df-dynamic li { margin:3px 0; font-size:12px; color:#aeb4c4; }
  .df-sites code, .df-dynamic code { font-family:ui-monospace,monospace; color:#cdd3e1; }
  .df-vs { color:#6b7280; }
  .df-keep { color:#5e9c7e; }
  .df-raw { color:#f0b765; }
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
  <h1>DriftFold <span class="tag">· design-system.html</span></h1>
  <p><span class="stat">${totalClusters}</span> drift clusters across <span class="stat">${totalSites}</span> overridden call sites. Mark each: snap-to a new variant, merge into an existing one, or keep. Download the changeset to fold them back.</p>
</header>
<main>${sections}</main>

<div id="dock">
  <div id="dock-bar">
    <b>changeset.json</b>
    <span class="hint">live — edits above update this</span>
    <button class="df-act" id="download">⬇ Download changeset.json</button>
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
