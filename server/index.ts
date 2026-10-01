// Serveri käivitus. AI võti loetakse keskkonnamuutujatest (.env), mitte lähtekoodist.
import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { openDb } from "./db.ts";
import { Repo } from "./repo.ts";
import { createProvider } from "./ai/provider.ts";
import { AiService } from "./ai/service.ts";
import { createApp } from "./app.ts";

// --mock: näidis-AI ilma API võtmeta (testimiseks ja demoks).
// Näidisandmed hoitakse eraldi failis, et need ei seguneks päris projektidega.
if (process.argv.includes("--mock")) {
  process.env.AI_PROVIDER = "mock";
  process.env.DB_FILE = "data/demo.db";
}

const port = Number(process.env.API_PORT || 3001);
const db = openDb(process.env.DB_FILE || "data/app.db");
const ai = new AiService(createProvider());
const app = createApp(new Repo(db), ai);

// Toodangurežiimis serveeritakse ehitatud kasutajaliidest (npm run build).
const dist = path.resolve("dist");
if (fs.existsSync(path.join(dist, "index.html"))) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(port, () => {
  console.log(`Server töötab: http://localhost:${port}`);
  console.log(`AI: ${ai.providerName}${ai.available ? "" : " (pole seadistatud – ANTHROPIC_API_KEY puudub, käsitsi haldus töötab)"}`);
});
