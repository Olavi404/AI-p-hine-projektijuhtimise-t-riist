// Mockup'ide galerii eksport: iseseisev HTML-fail (ilma skriptideta), mille saab avada ilma rakenduseta.
// Kõik tekstid paotatakse (escape), seega AI loodud sisu ei saa failis koodi käivitada.
import fs from "node:fs";
import path from "node:path";
import type { MockupElement, MockupSpec, MockupVersion, Project, Story } from "../shared/types.ts";
import { STATUS_LABELS } from "../shared/types.ts";
import { storyTitle } from "../shared/quality.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Mockup'i stiilid (kasutatakse HTML-galeriis ja piltide tegemisel). */
export const MOCKUP_CSS = String.raw`:root{--bg:#0f1117;--panel:#12141b;--surface:#171a22;--border:#2c303b;--text:#dfe2ea;--muted:#8a8f9e;--accent:#8b5cf6;--accent-text:#c4b5fd;--mono:Consolas,ui-monospace,monospace;color-scheme:dark}
.mockup{border:1px solid var(--border);border-radius:8px;background:#0c0e13;overflow:hidden;font-size:.85rem}
.chrome{display:flex;align-items:center;gap:5px;padding:6px 10px;background:var(--surface);border-bottom:1px solid var(--border)}.chrome i{width:7px;height:7px;border-radius:50%;background:#3a3f4d}.chrome span{margin-left:8px;font-family:var(--mono);font-size:.75rem;color:var(--muted)}
.body{padding:10px;display:flex;flex-direction:column;gap:10px}.sec h5{margin:0 0 6px;font-size:.9rem}
.els{display:flex;flex-direction:column;gap:6px}.sec.row .els{flex-direction:row;flex-wrap:wrap;align-items:center}.sec.grid .els{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}
.el{position:relative;border:1px dashed #3a3f4d;border-radius:5px;padding:6px 8px;color:#b9bdc9}.eid{position:absolute;top:-8px;right:6px;font-family:var(--mono);font-size:.65rem;color:var(--accent-text);background:#0c0e13;padding:0 3px}
.t-nav{display:flex;justify-content:space-between;gap:10px;background:var(--surface)}.nav-items{display:flex;gap:10px;color:var(--muted)}
.el h4{margin:0;font-size:1rem;color:#f3f4f8}.img{height:60px;display:grid;place-items:center;background:var(--surface);border-radius:4px;color:var(--muted)}
.btn{display:inline-block;background:#3a3f4d;color:#f3f4f8;padding:3px 10px;border-radius:4px}.link{color:var(--accent-text);text-decoration:underline}
.field{display:flex;flex-direction:column;gap:3px}.input{border:1px solid var(--border);border-radius:4px;padding:3px 6px;color:#5d6170;min-height:24px;background:var(--bg)}
.price{font-size:1.05rem;font-weight:600;color:#f3f4f8;display:block}.note{color:var(--muted)}.badge{background:var(--surface);padding:1px 8px;border-radius:4px}
.table{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:2px}.table span{border:1px solid var(--border);padding:2px 4px}
.el ul{margin:3px 0 0;padding-left:16px}.el p{margin:3px 0}`;

export interface GalleryStory {
  story: Story;
  versions: MockupVersion[];
}

function renderElement(e: MockupElement): string {
  const label = esc(e.label);
  const detail = e.detail ? esc(e.detail) : "";
  const items = e.items.map(esc);
  switch (e.type) {
    case "nav":
      return `<strong>${label}</strong><span class="nav-items">${items.map((i) => `<span>${i}</span>`).join("")}</span>`;
    case "heading":
      return `<h4>${label}</h4>`;
    case "image":
      return `<div class="img">▧ ${label}</div>`;
    case "button":
      return `<span class="btn">${label}</span>`;
    case "link":
      return `<span class="link">${label}</span>`;
    case "input":
      return `<span class="field">${label}<span class="input">${detail}</span></span>`;
    case "select":
      return `<span class="field">${label}<span class="input">${items[0] ?? detail} ▾</span></span>`;
    case "checkbox":
      return `☐ ${label}${detail ? ` <small>${detail}</small>` : ""}`;
    case "list":
      return `${label ? `<strong>${label}</strong>` : ""}<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    case "table":
      return `${label ? `<strong>${label}</strong>` : ""}<div class="table">${items.map((i) => `<span>${i}</span>`).join("")}</div>`;
    case "card":
      return `<strong>${label}</strong>${detail ? `<p>${detail}</p>` : ""}${items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : ""}`;
    case "price":
      return `<span class="price">${label}</span>${detail ? `<small class="note">${detail}</small>` : ""}`;
    case "badge":
      return `<span class="badge">${label}</span>`;
    case "notice":
      return `✓ ${label}${detail ? ` <small>– ${detail}</small>` : ""}`;
    default:
      return `${label}${detail ? ` <small>${detail}</small>` : ""}`;
  }
}

export function renderMockup(spec: MockupSpec): string {
  return `<div class="mockup"><div class="chrome"><i></i><i></i><i></i><span>${esc(spec.title)}</span></div><div class="body">${spec.sections
    .map(
      (s) =>
        `<section class="sec ${s.layout}">${s.heading ? `<h5>${esc(s.heading)}</h5>` : ""}<div class="els">${s.elements
          .map((e) => `<div class="el t-${e.type}" title="${esc(e.id)}"><span class="eid">${esc(e.id)}</span>${renderElement(e)}</div>`)
          .join("")}</div></section>`,
    )
    .join("")}</div></div>`;
}

export function galleryHtml(project: Project, items: GalleryStory[], missing: Story[]): string {
  const date = new Date().toLocaleString("et-EE");
  const cards = items
    .map(({ story, versions }) => {
      const current = versions.find((v) => v.isCurrent) ?? versions[0];
      const older = versions.filter((v) => v.id !== current.id);
      return `<article class="card" id="${esc(story.code)}">
  <header>
    <span class="code">${esc(story.code)}</span>
    <h2>${esc(storyTitle(story))}</h2>
    <div class="tags"><span class="tag">${esc(STATUS_LABELS[story.status])}</span><span class="tag">v${current.version} / ${versions.length} versiooni</span>${story.size ? `<span class="tag">${esc(story.size)}</span>` : ""}</div>
  </header>
  <div class="cols">
    ${renderMockup(current.spec)}
    <div>
      <h3>Vastuvõtukriteeriumid</h3>
      ${story.criteria.length ? `<ol class="crit">${story.criteria.map((c) => `<li>${esc(c.text)}${c.elementIds.length ? ` <span class="ids">${c.elementIds.map(esc).join(", ")}</span>` : ""}</li>`).join("")}</ol>` : `<p class="muted">Kriteeriume pole.</p>`}
      ${story.openQuestions.length ? `<h3>Avatud küsimused</h3><ul>${story.openQuestions.map((q) => `<li>${esc(q.text)}</li>`).join("")}</ul>` : ""}
      ${current.note ? `<p class="muted">Versiooni märkus: ${esc(current.note)}</p>` : ""}
    </div>
  </div>
  ${
    older.length
      ? `<details><summary>Varasemad versioonid (${older.length})</summary><div class="older">${older
          .map((v) => `<figure><figcaption>v${v.version} · ${esc(new Date(v.createdAt).toLocaleString("et-EE"))}${v.note ? ` · ${esc(v.note)}` : ""}</figcaption>${renderMockup(v.spec)}</figure>`)
          .join("")}</div></details>`
      : ""
  }
</article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="et">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(project.name)} – mockup'ide galerii</title>
<style>
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 "Segoe UI",system-ui,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:32px 20px 60px}
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;border:1px solid var(--border);border-radius:14px;padding:20px 22px;background:radial-gradient(600px 160px at 0 0,rgba(139,92,246,.18),transparent 70%),var(--panel)}
.top h1{margin:0 0 4px;font-size:1.6rem}.muted{color:var(--muted)}
nav.toc{display:flex;flex-wrap:wrap;gap:6px;margin:18px 0 24px}nav.toc a{font-family:var(--mono);font-size:.8rem;color:var(--accent-text);text-decoration:none;border:1px solid var(--border);border-radius:6px;padding:3px 9px;background:var(--surface)}nav.toc a:hover{border-color:var(--accent)}
.card{border:1px solid var(--border);border-radius:14px;background:var(--panel);padding:18px 20px;margin-bottom:22px;scroll-margin-top:16px}
.card header{margin-bottom:14px}.code{font-family:var(--mono);color:var(--accent-text)}.card h2{display:inline;font-size:1.05rem;margin:0 0 0 6px}
.tags{margin-top:6px;display:flex;gap:5px;flex-wrap:wrap}.tag{font-size:.75rem;padding:1px 8px;border-radius:4px;background:var(--surface);border:1px solid var(--border);color:var(--muted)}
.cols{display:grid;grid-template-columns:1.25fr 1fr;gap:20px;align-items:start}
h3{font-family:var(--mono);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}
ol.crit{margin:0 0 12px;padding-left:20px}ol.crit li{margin:3px 0}.ids{font-family:var(--mono);font-size:.72rem;color:var(--accent-text);border:1px solid var(--border);border-radius:4px;padding:0 5px}
details{margin-top:14px;border-top:1px dashed var(--border);padding-top:10px}summary{cursor:pointer;color:var(--accent-text)}
.older{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;margin-top:10px}figure{margin:0}figcaption{font-size:.78rem;color:var(--muted);margin-bottom:5px}
${MOCKUP_CSS}
.missing{border:1px dashed var(--border);border-radius:12px;padding:14px 18px}.missing li{margin:3px 0}
footer{margin-top:30px;font-size:.8rem;color:var(--muted);text-align:center}
@media(max-width:860px){.cols{grid-template-columns:1fr}}
@media print{body{background:#fff;color:#000}.card{break-inside:avoid}}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div><h1>${esc(project.name)}</h1><div class="muted">Mockup'ide galerii${project.description ? ` · ${esc(project.description)}` : ""}</div></div>
    <div class="muted">${items.length} mockup'iga lugu · eksporditud ${esc(date)}</div>
  </div>
  <nav class="toc">${items.map(({ story }) => `<a href="#${esc(story.code)}">${esc(story.code)}</a>`).join("")}</nav>
  ${items.length ? cards : `<p class="muted">Selles projektis pole veel ühtegi mockup'i.</p>`}
  ${
    missing.length
      ? `<div class="missing"><h3>Vaadet puudutavad lood ilma mockup'ita (${missing.length})</h3><ul>${missing.map((s) => `<li><span class="code">${esc(s.code)}</span> ${esc(storyTitle(s))}</li>`).join("")}</ul></div>`
      : ""
  }
  <footer>Loodud rakendusega KickOff AI</footer>
</div>
</body>
</html>`;
}

/** Kaustanimi projekti nimest: "Spordiklubi (päris AI)" -> "spordiklubi-paris-ai". */
export function slugify(name: string): string {
  const s = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "projekt";
}

/** Kirjutab galerii projekti kausta exports/<projekt>/ (galerii.html + mockups.json). */
export function writeGalleryFolder(root: string, project: Project, items: GalleryStory[], missing: Story[]): { dir: string; files: string[] } {
  const base = path.resolve(root);
  const dir = path.join(base, slugify(project.name));
  if (!dir.startsWith(base + path.sep)) throw new Error("Vigane kaustanimi.");
  fs.mkdirSync(dir, { recursive: true });
  const html = path.join(dir, "galerii.html");
  const json = path.join(dir, "mockups.json");
  fs.writeFileSync(html, galleryHtml(project, items, missing), "utf8");
  fs.writeFileSync(
    json,
    JSON.stringify(
      {
        project: { name: project.name, description: project.description },
        exportedAt: new Date().toISOString(),
        stories: items.map(({ story, versions }) => ({
          code: story.code,
          title: storyTitle(story),
          status: story.status,
          criteria: story.criteria.map((c) => ({ text: c.text, elementIds: c.elementIds })),
          mockups: versions.map((v) => ({ version: v.version, current: v.isCurrent, note: v.note, createdAt: v.createdAt, spec: v.spec })),
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
  return { dir, files: [html, json] };
}
