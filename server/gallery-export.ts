// Galerii git-repositooriumi jaoks (kaust galerii/): GitHubis loetav README.md koos PNG-piltidega,
// iga projekti HTML-galerii ja mockups.json. Pildid tehakse kohaliku Chrome/Edge headless-režiimiga.
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Repo } from "./repo.ts";
import { MOCKUP_CSS, renderMockup, slugify, writeGalleryFolder, type GalleryStory } from "./gallery.ts";
import { storyTitle } from "../shared/quality.ts";
import { STATUS_LABELS, type MockupSpec, type Project } from "../shared/types.ts";

const BROWSERS = [
  process.env.BROWSER_BIN,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

export function findBrowser(): string | null {
  return BROWSERS.find((p): p is string => !!p && fs.existsSync(p)) ?? null;
}

/** Teeb mockup'ist PNG-pildi täpselt sisu kõrgusega (1. käivitus mõõdab kõrguse, 2. teeb pildi). */
export async function screenshotMockup(browser: string, spec: MockupSpec, outFile: string, width = 820): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kickoff-shot-"));
  try {
    const page = path.join(tmp, "mockup.html");
    fs.writeFileSync(
      page,
      `<!doctype html><html><head><meta charset="utf-8"><style>${MOCKUP_CSS}
html,body{margin:0;background:#0f1117;color:#dfe2ea;font:14px/1.5 "Segoe UI",system-ui,sans-serif}#wrap{padding:16px;width:${width - 32}px}</style></head>
<body><div id="wrap">${renderMockup(spec)}</div><script>document.body.setAttribute("data-h",Math.ceil(document.getElementById("wrap").getBoundingClientRect().height))</script></body></html>`,
      "utf8",
    );
    const url = pathToFileURL(page).href;
    const base = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${path.join(tmp, "profile")}`];
    const run = (args: string[]) =>
      new Promise<string>((resolve, reject) =>
        execFile(browser, [...base, ...args], { timeout: 60_000, maxBuffer: 20_000_000 }, (err, stdout) => (err ? reject(err) : resolve(stdout))),
      );
    const dom = await run([`--window-size=${width},800`, "--dump-dom", url]);
    const height = Math.min(6000, Math.max(200, Number(dom.match(/data-h="(\d+)"/)?.[1] ?? 900)));
    await run([`--window-size=${width},${height}`, `--screenshot=${path.resolve(outFile)}`, url]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

interface ProjectGallery {
  project: Project;
  slug: string;
  items: GalleryStory[];
  missing: number;
  images: Map<string, string>; // mockup id -> suhteline pildi tee
}

/** Ekspordib kõigi mockup'iga projektide galerii kausta `root` (vaikimisi galerii/). */
export async function exportRepoGallery(repo: Repo, root: string, log: (m: string) => void = () => {}): Promise<{ dir: string; projects: number; mockups: number; images: number; browser: string | null }> {
  const base = path.resolve(root);
  fs.mkdirSync(base, { recursive: true });
  const browser = findBrowser();
  if (!browser) log("Chrome'i/Edge'i ei leitud – pildid jäetakse vahele (määra BROWSER_BIN).");

  const galleries: ProjectGallery[] = [];
  for (const summary of repo.listProjects()) {
    const project = repo.getProject(summary.id);
    const stories = repo.listStories(project.id);
    const items: GalleryStory[] = stories.filter((s) => s.mockup).map((story) => ({ story, versions: repo.listMockupVersions(story.id) }));
    if (items.length === 0) continue;
    const missing = stories.filter((s) => s.isView && !s.mockup);
    const { dir } = writeGalleryFolder(base, project, items, missing);
    const slug = path.basename(dir);
    // Vanad pildid eemaldatakse, et kustutatud mockup'id ei jääks repositooriumi.
    const imgDir = path.join(dir, "img");
    fs.rmSync(imgDir, { recursive: true, force: true });
    fs.mkdirSync(imgDir, { recursive: true });
    const images = new Map<string, string>();
    if (browser) {
      for (const { story, versions } of items) {
        for (const v of versions) {
          const name = `${story.code}-v${v.version}.png`;
          try {
            await screenshotMockup(browser, v.spec, path.join(imgDir, name));
            images.set(v.id, `${slug}/img/${name}`);
            log(`  ${project.name}: ${name}`);
          } catch (e) {
            log(`  ${project.name}: ${name} ebaõnnestus (${(e as Error).message})`);
          }
        }
      }
    }
    galleries.push({ project, slug, items, missing: missing.length, images });
  }

  fs.writeFileSync(path.join(base, "README.md"), readme(galleries), "utf8");
  fs.writeFileSync(path.join(base, "index.html"), indexHtml(galleries), "utf8");
  const mockups = galleries.reduce((n, g) => n + g.items.reduce((k, i) => k + i.versions.length, 0), 0);
  const imageCount = galleries.reduce((n, g) => n + g.images.size, 0);
  return { dir: base, projects: galleries.length, mockups, images: imageCount, browser };
}

const md = (s: string) => s.replace(/([\\`*_[\]<>|])/g, "\\$1");

function readme(galleries: ProjectGallery[]): string {
  const lines: string[] = [];
  lines.push("# Mockup'ide galerii", "");
  lines.push(`KickOff AI-ga loodud vaadete kavandid (mockup'id) koos kasutajalugude ja vastuvõtukriteeriumidega. Uuendatud ${new Date().toLocaleString("et-EE")}.`, "");
  lines.push("Iga projekti kaustas on ka `galerii.html` (sama galerii brauseris avamiseks: laadi fail alla ja ava see, sh varasemad versioonid) ja `mockups.json` (kõik versioonid masinloetaval kujul). Pildil olevad lühikesed tunnused (e1, e2, …) on mockup'i elemendid, millele kriteeriumid viitavad.", "");
  if (galleries.length === 0) {
    lines.push("_Mockup'e veel pole._");
    return lines.join("\n");
  }
  lines.push("## Projektid", "");
  for (const g of galleries) {
    lines.push(`- [${md(g.project.name)}](#${anchor(g.project.name)}) – ${g.items.length} mockup'iga lugu`);
  }
  lines.push("");
  for (const g of galleries) {
    lines.push(`## ${md(g.project.name)}`, "");
    if (g.project.description) lines.push(md(g.project.description), "");
    lines.push(`[Ava HTML-galerii](${g.slug}/galerii.html) · [mockups.json](${g.slug}/mockups.json)`, "");
    for (const { story, versions } of g.items) {
      const current = versions.find((v) => v.isCurrent) ?? versions[0];
      lines.push(`### ${story.code}. ${md(storyTitle(story))}`, "");
      lines.push(`Staatus: **${STATUS_LABELS[story.status]}** · suurus: ${story.size ?? "–"} · mockup v${current.version}${versions.length > 1 ? ` (${versions.length} versiooni)` : ""}`, "");
      const img = g.images.get(current.id);
      lines.push(img ? `![${md(current.spec.title)}](${img})` : `_Pilt puudub – vaata [HTML-galeriid](${g.slug}/galerii.html#${story.code})._`, "");
      if (story.criteria.length) {
        lines.push("**Vastuvõtukriteeriumid**", "");
        for (const c of story.criteria) lines.push(`- [ ] ${md(c.text)}${c.elementIds.length ? ` \`${c.elementIds.join(", ")}\`` : ""}`);
        lines.push("");
      }
      const older = versions.filter((v) => v.id !== current.id);
      if (older.length) {
        lines.push("<details><summary>Varasemad versioonid</summary>", "");
        for (const v of older) {
          const oi = g.images.get(v.id);
          lines.push(`**v${v.version}**${v.note ? ` – ${md(v.note)}` : ""}`, "", oi ? `![v${v.version}](${oi})` : "_pilt puudub_", "");
        }
        lines.push("</details>", "");
      }
    }
    if (g.missing) lines.push(`_Lisaks on ${g.missing} vaadet puudutavat lugu, millel mockup veel puudub._`, "");
  }
  return lines.join("\n");
}

function anchor(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function indexHtml(galleries: ProjectGallery[]): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!doctype html><html lang="et"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mockup'ide galerii – KickOff AI</title>
<style>body{margin:0;background:#0f1117;color:#dfe2ea;font:15px/1.5 "Segoe UI",system-ui,sans-serif}.w{max-width:900px;margin:0 auto;padding:40px 20px}h1{margin:0 0 6px}p{color:#8a8f9e}a.c{display:block;border:1px solid #2c303b;border-radius:12px;padding:16px 18px;margin:12px 0;color:#dfe2ea;text-decoration:none;background:#12141b}a.c:hover{border-color:#8b5cf6}a.c b{display:block;font-size:1.05rem}a.c span{color:#8a8f9e;font-size:.85rem}</style></head>
<body><div class="w"><h1>Mockup'ide galerii</h1><p>KickOff AI · ${galleries.length} projekti</p>
${galleries.map((g) => `<a class="c" href="${esc(g.slug)}/galerii.html"><b>${esc(g.project.name)}</b><span>${g.items.length} mockup'iga lugu${g.project.description ? ` · ${esc(g.project.description)}` : ""}</span></a>`).join("\n")}
</div></body></html>`;
}

export { slugify };
