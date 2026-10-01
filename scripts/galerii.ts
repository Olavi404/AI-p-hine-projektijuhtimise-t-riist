// Ekspordib kõigi projektide mockup'id repositooriumi kausta galerii/ (README.md + pildid + HTML).
// Kasutus: npm run galerii [-- --db data/app.db --out galerii]
import "dotenv/config";
import { openDb } from "../server/db.ts";
import { Repo } from "../server/repo.ts";
import { exportRepoGallery } from "../server/gallery-export.ts";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const dbFile = arg("db") ?? process.env.DB_FILE ?? "data/app.db";
const out = arg("out") ?? process.env.GALLERY_DIR ?? "galerii";
console.log(`Andmebaas: ${dbFile} → kaust: ${out}`);
const res = await exportRepoGallery(new Repo(openDb(dbFile)), out, console.log);
console.log(`Valmis: ${res.projects} projekti, ${res.mockups} mockup'i versiooni, ${res.images} pilti → ${res.dir}`);
if (!res.browser) console.log("Pilte ei tehtud: Chrome'i/Edge'i ei leitud (määra BROWSER_BIN).");
