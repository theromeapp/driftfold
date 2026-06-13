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
  { value: "snap-to", label: "✨ New style" },
  { value: "merge-into", label: "🔁 Replace (it's a duplicate)" },
  { value: "keep", label: "✋ Keep as-is" },
  { value: "rename", label: "✏️ Rename" },
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
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    color-scheme: dark;
    --bg:#080a10; --panel:#10131d; --panel-2:#141826; --line:#222840; --line-soft:#1b2034;
    --ink:#e9ebf2; --ink-2:#aab2c8; --ink-3:#6f7791;
    --blue:#4f8cff; --blue-deep:#2f6ad9; --violet:#8b6bff; --amber:#f0b765; --coral:#f08aa6; --mint:#5ed6a4;
    --sans:'IBM Plex Sans',ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
    --display:'Fraunces',Georgia,serif;
  }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.55 var(--sans); color:var(--ink); background:var(--bg);
         background-image:
           radial-gradient(900px 480px at 12% -8%, rgba(79,140,255,.14), transparent 60%),
           radial-gradient(760px 420px at 92% -4%, rgba(139,107,255,.12), transparent 62%),
           radial-gradient(600px 600px at 50% 120%, rgba(94,214,164,.05), transparent 60%);
         background-attachment:fixed; -webkit-font-smoothing:antialiased; }
  ::selection { background:rgba(79,140,255,.32); }
  header { padding:30px 32px 18px; border-bottom:1px solid var(--line-soft); position:sticky; top:0;
           background:rgba(8,10,16,.82); backdrop-filter:blur(10px) saturate(1.1); z-index:20; }
  header h1 { margin:0; font-family:var(--display); font-weight:600; font-size:30px; letter-spacing:-.02em;
              background:linear-gradient(92deg,#fff 18%,#bcd0ff 72%,#c9bdff); -webkit-background-clip:text;
              background-clip:text; color:transparent; }
  header h1 .tag { font-family:var(--sans); font-size:13.5px; font-weight:400; letter-spacing:0;
                   color:var(--ink-3); -webkit-text-fill-color:var(--ink-3); }
  header p { margin:9px 0 0; color:var(--ink-2); max-width:780px; font-size:14.5px; }
  .stat { color:var(--mint); font-weight:600; font-variant-numeric:tabular-nums; }
  .how { margin:15px 0 0; display:flex; flex-wrap:wrap; gap:9px; align-items:center;
         font-size:12.5px; color:var(--ink-2); }
  .how b { color:var(--ink); margin-right:3px; }
  .how span { background:var(--panel); border:1px solid var(--line-soft); border-radius:8px; padding:5px 10px; }
  .how em { color:#fff; font-style:normal; font-weight:600; }
  main { max-width:1200px; margin:0 auto; padding:30px 32px 250px; }
  .df-component { margin:42px 0; }
  .df-component:first-child { margin-top:26px; }
  .df-component h2 { font-family:var(--display); font-weight:600; font-size:23px; letter-spacing:-.015em;
                     margin:0 0 16px; display:flex; align-items:baseline; gap:11px; }
  .df-sub { color:var(--ink-3); font-weight:400; font-size:13px; font-family:var(--sans); letter-spacing:0; }
  .df-clean { color:var(--mint); font-weight:600; font-size:13px; font-family:var(--sans); }
  .df-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(310px,1fr)); gap:16px; }
  .df-cluster { position:relative; border-radius:14px; padding:16px;
                background:linear-gradient(180deg,var(--panel-2),var(--panel));
                border:1px solid var(--line); box-shadow:0 1px 0 rgba(255,255,255,.03) inset, 0 8px 24px -16px rgba(0,0,0,.8);
                transition:transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
  .df-cluster:hover { transform:translateY(-2px); border-color:#2e3656;
                      box-shadow:0 1px 0 rgba(255,255,255,.04) inset, 0 16px 34px -18px rgba(0,0,0,.9); }
  .df-cluster-head { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
  .df-cid { font-family:var(--mono); font-weight:600; color:var(--ink-2); }
  .df-count { color:var(--ink); font-size:13px; font-weight:600; letter-spacing:-.01em; }
  .df-tag { font-size:10.5px; padding:2px 8px; border-radius:999px; font-weight:600; letter-spacing:.01em;
            border:1px solid transparent; }
  .df-tag-outlier { background:rgba(240,183,101,.12); color:var(--amber); border-color:rgba(240,183,101,.3); }
  .df-tag-mistake { background:rgba(240,138,166,.12); color:var(--coral); border-color:rgba(240,138,166,.32); }
  .df-swatch { background:radial-gradient(120% 120% at 50% 0%,#fafafa,#ececed); border-radius:10px; padding:20px;
               display:flex; align-items:center; justify-content:center; min-height:68px; margin-bottom:12px;
               box-shadow:0 1px 2px rgba(0,0,0,.4) inset; }
  .df-desc { margin:0 0 13px; font-size:13.5px; color:var(--ink); font-weight:500; letter-spacing:-.005em; }
  .df-chips-wrap { margin-top:11px; }
  .df-chips-wrap summary, .df-sites summary, .df-dynamic summary { cursor:pointer; color:var(--ink-3);
            font-size:12px; transition:color .12s ease; }
  .df-chips-wrap summary:hover, .df-sites summary:hover, .df-dynamic summary:hover { color:var(--blue); }
  .df-chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:9px; }
  .df-chip { font-family:var(--mono); font-size:11px; background:rgba(79,140,255,.09);
             color:#9fb4e8; padding:2px 7px; border-radius:6px; border:1px solid rgba(79,140,255,.14); }
  .df-proposal { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .df-proposal label { color:var(--ink-2); font-size:11px; font-weight:600; width:100%; text-transform:uppercase;
                       letter-spacing:.07em; margin-bottom:2px; }
  .df-select, .df-input { background:#0b0e16; color:var(--ink); border:1px solid #2a3147;
             border-radius:8px; padding:8px 10px; font-size:13px; font-family:var(--sans); transition:border-color .14s ease; }
  .df-select { flex:1; min-width:200px; font-weight:500; cursor:pointer; }
  .df-input { flex:1; min-width:120px; }
  .df-select:focus, .df-input:focus { outline:none; border-color:var(--blue); box-shadow:0 0 0 3px rgba(79,140,255,.15); }
  .df-input:disabled { cursor:not-allowed; }
  /* the adaptive plain-English sentence — the line a human actually reads to know what their pick does */
  .df-plain { margin:12px 0 0; padding:10px 12px; font-size:13.5px; line-height:1.5; color:var(--ink); font-weight:500;
              background:linear-gradient(180deg,rgba(79,140,255,.08),rgba(79,140,255,.03));
              border:1px solid rgba(79,140,255,.2); border-left:3px solid var(--blue); border-radius:9px; }
  .df-merge .df-plain { background:linear-gradient(180deg,rgba(139,107,255,.1),rgba(139,107,255,.03));
              border-color:rgba(139,107,255,.26); border-left-color:var(--violet); }
  .df-why-wrap { margin-top:9px; }
  .df-why-wrap summary { cursor:pointer; color:var(--ink-3); font-size:12px; list-style:none; transition:color .12s ease; }
  .df-why-wrap summary:hover { color:var(--blue); }
  .df-why-wrap summary::-webkit-details-marker { display:none; }
  .df-why-wrap summary::before { content:"ⓘ "; color:#5a6075; }
  .df-why { color:var(--ink-2); font-size:12.5px; margin:8px 0 0; font-style:italic; }
  .df-sites { margin-top:11px; }
  .df-sites ul, .df-dynamic ul { margin:9px 0 0; padding-left:18px; }
  .df-sites li, .df-dynamic li { margin:4px 0; font-size:12px; color:var(--ink-2); }
  .df-sites code, .df-dynamic code { font-family:var(--mono); color:var(--ink-2); }
  .df-ln { color:var(--ink-3); }
  .df-keep { color:var(--mint); }
  .df-dynamic { margin-top:16px; }
  .df-merge { border-color:rgba(139,107,255,.55) !important;
              box-shadow:0 0 0 1px rgba(139,107,255,.25), 0 16px 34px -18px rgba(139,107,255,.4) !important; }
  /* live changeset dock */
  #dock { position:fixed; bottom:0; left:0; right:0; background:rgba(9,11,18,.94); border-top:1px solid var(--line);
          backdrop-filter:blur(12px); z-index:30; max-height:230px; overflow:auto; }
  #dock-bar { display:flex; align-items:center; gap:12px; padding:11px 32px; position:sticky; top:0;
              background:rgba(9,11,18,.96); border-bottom:1px solid var(--line-soft); }
  #dock-bar b { font-size:13px; font-weight:600; } #dock-bar .hint { color:var(--ink-3); font-size:12px; }
  #dock pre { margin:0; padding:13px 32px 22px; font-family:var(--mono); font-size:11.5px;
              color:#9fb4e8; white-space:pre; }
  button.df-act { margin-left:auto; }
  button.df-act, #copy { background:linear-gradient(180deg,var(--blue),var(--blue-deep)); color:#fff; border:0;
          border-radius:8px; padding:8px 15px; font-size:13px; font-weight:600; cursor:pointer; font-family:var(--sans);
          box-shadow:0 6px 16px -8px rgba(79,140,255,.7); transition:transform .12s ease, filter .12s ease; }
  #copy { margin-left:8px; background:#1c2236; box-shadow:none; }
  button.df-act:hover { filter:brightness(1.08); transform:translateY(-1px); }
  #copy:hover { background:#252c46; }
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
        ? 'Create a new “' + name + '” style and use it in all ' + here + '.'
        : 'Make this a new reusable style — name it on the right.';
    if (decision === 'merge-into')
      return name
        ? 'Replace these ' + here + ' with the existing “' + name + '” style.'
        : 'These are duplicates — type which style to replace them with.';
    if (decision === 'rename')
      return name ? 'Rename this style to “' + name + '”.' : 'Keep it, but give it a name on the right.';
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
        decision === 'merge-into' ? 'replace with… e.g. brand' : 'name it… e.g. Primary';
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
