// HTTP API. Kõik muutvad päringud tagastavad projekti värske seisu, et brauser näeks alati andmebaasi tegelikku olekut.
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { Repo, NotFoundError, ValidationError } from "./repo.ts";
import { AiService } from "./ai/service.ts";
import { Flow } from "./flow.ts";
import { mergeStories, splitStory, updateStory } from "./backlog.ts";
import { toCsv, toMarkdown } from "./export.ts";
import {
  ChatActionSchema,
  MergeSchema,
  MockupRestoreSchema,
  ProjectCreateSchema,
  ProjectPatchSchema,
  ReorderSchema,
  SplitSchema,
  StoryCreateSchema,
  StoryPatchSchema,
} from "./validation.ts";
import type { ProjectState } from "../shared/types.ts";

export function createApp(repo: Repo, ai: AiService): express.Express {
  const app = express();
  const flow = new Flow(repo, ai);
  const busy = new Set<string>();

  app.use(express.json({ limit: "1mb" }));

  const state = (projectId: string): ProjectState => {
    const label = repo.lastSnapshotLabel(projectId);
    return {
      project: repo.getProject(projectId),
      stories: repo.listStories(projectId),
      messages: repo.listMessages(projectId),
      proposals: repo.listProposals(projectId),
      undo: { available: label !== null, label },
      ai: { available: ai.available, provider: ai.providerName },
    };
  };

  const pid = (req: Request) => {
    const id = String(req.params.id);
    repo.getProject(id);
    return id;
  };

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, ai: { available: ai.available, provider: ai.providerName } });
  });

  // ---------- Projektid ----------

  app.get("/api/projects", (_req, res) => {
    res.json(repo.listProjects());
  });

  app.post("/api/projects", (req, res) => {
    const body = ProjectCreateSchema.parse(req.body);
    const project = repo.createProject(body.name, body.description);
    repo.addMessage(project.id, {
      role: "assistant",
      text: `Tere! Alustame projektiga „${project.name}“. Kirjelda ühe-kahe lausega, mida klient soovib – näiteks „Spordiklubi tahab veebi, kus saab treeningutega tutvuda ja liikmeks astuda.“ Ma esitan seejärel täpsustavad küsimused ja pakun kasutajalood.`,
    });
    res.status(201).json(state(project.id));
  });

  app.get("/api/projects/:id", (req, res) => {
    res.json(state(pid(req)));
  });

  app.patch("/api/projects/:id", (req, res) => {
    const id = pid(req);
    const body = ProjectPatchSchema.parse(req.body);
    if (body.mvpLine !== undefined) {
      const count = repo.listStories(id).length;
      const line = body.mvpLine === null ? null : Math.min(body.mvpLine, count);
      repo.mutate(id, line === null ? "MVP joone eemaldamine" : "MVP joone määramine", () => repo.updateProject(id, { mvpLine: line }));
    }
    if (body.name !== undefined || body.description !== undefined) {
      repo.updateProject(id, { ...(body.name ? { name: body.name } : {}), ...(body.description !== undefined ? { description: body.description } : {}) });
    }
    res.json(state(id));
  });

  app.delete("/api/projects/:id", (req, res) => {
    repo.deleteProject(pid(req));
    res.status(204).end();
  });

  // ---------- Juhitud vestlus ----------

  app.post("/api/projects/:id/chat", async (req, res) => {
    const id = pid(req);
    const action = ChatActionSchema.parse(req.body);
    if (busy.has(id)) {
      res.status(409).json({ error: "Eelmine päring on veel pooleli. Oota hetk." });
      return;
    }
    busy.add(id);
    try {
      await flow.handle(id, action);
    } finally {
      busy.delete(id);
    }
    res.json(state(id));
  });

  // ---------- Backlog'i käsitsi haldus (töötab ka ilma AI-ta) ----------

  app.post("/api/projects/:id/stories", (req, res) => {
    const id = pid(req);
    const body = StoryCreateSchema.parse(req.body);
    repo.mutate(id, "Loo lisamine käsitsi", () =>
      repo.createStory(id, { role: body.role, action: body.action, benefit: body.benefit, size: body.size ?? null, isView: body.isView ?? true, origin: "manual" }, body.index),
    );
    res.status(201).json(state(id));
  });

  app.patch("/api/projects/:id/stories/:sid", (req, res) => {
    const id = pid(req);
    const body = StoryPatchSchema.parse(req.body);
    updateStory(repo, id, String(req.params.sid), body);
    res.json(state(id));
  });

  app.delete("/api/projects/:id/stories/:sid", (req, res) => {
    const id = pid(req);
    const story = repo.getProjectStory(id, String(req.params.sid));
    repo.mutate(id, `Loo ${story.code} kustutamine`, () => repo.deleteStory(story.id));
    res.json(state(id));
  });

  app.post("/api/projects/:id/reorder", (req, res) => {
    const id = pid(req);
    const { orderedIds } = ReorderSchema.parse(req.body);
    repo.mutate(id, "Järjekorra muutmine", () => repo.reorder(id, orderedIds));
    res.json(state(id));
  });

  app.post("/api/projects/:id/stories/:sid/split", (req, res) => {
    const id = pid(req);
    const { parts } = SplitSchema.parse(req.body);
    splitStory(repo, id, String(req.params.sid), parts, "manual");
    res.json(state(id));
  });

  app.post("/api/projects/:id/merge", (req, res) => {
    const id = pid(req);
    const { storyIds, merged } = MergeSchema.parse(req.body);
    mergeStories(repo, id, storyIds, merged, "manual");
    res.json(state(id));
  });

  app.get("/api/projects/:id/stories/:sid/mockups", (req, res) => {
    const id = pid(req);
    const story = repo.getProjectStory(id, String(req.params.sid));
    res.json(repo.listMockupVersions(story.id));
  });

  app.post("/api/projects/:id/stories/:sid/mockups/restore", (req, res) => {
    const id = pid(req);
    const story = repo.getProjectStory(id, String(req.params.sid));
    const { mockupId } = MockupRestoreSchema.parse(req.body);
    const version = repo.listMockupVersions(story.id).find((m) => m.id === mockupId);
    if (!version) throw new NotFoundError("Mockup'i versiooni ei leitud.");
    repo.mutate(id, `Loo ${story.code} mockup'i v${version.version} taastamine`, () => repo.setCurrentMockup(story.id, mockupId));
    res.json(state(id));
  });

  app.post("/api/projects/:id/undo", (req, res) => {
    const id = pid(req);
    const label = repo.undo(id);
    res.json({ ...state(id), undone: label });
  });

  // ---------- Eksport ----------

  app.get("/api/projects/:id/export.md", (req, res) => {
    const id = pid(req);
    res.type("text/markdown; charset=utf-8").attachment("backlog.md").send(toMarkdown(repo.getProject(id), repo.listStories(id)));
  });

  app.get("/api/projects/:id/export.csv", (req, res) => {
    const id = pid(req);
    res.type("text/csv; charset=utf-8").attachment("backlog.csv").send(toCsv(repo.listStories(id)));
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Tundmatu päring." });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: "Vigane päring: " + err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    } else if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
    } else {
      console.error(err);
      res.status(500).json({ error: "Serveri viga. Vaata serveri logi." });
    }
  });

  return app;
}
