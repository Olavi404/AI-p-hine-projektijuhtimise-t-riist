// Brauseri pool suhtleb ainult oma serveriga; AI võti brauserisse ei jõua.
import type { ChatAction, CriterionDraft, MockupVersion, ProjectState, ProjectSummary, Story, StoryDraft, StoryStatus, StorySize, OpenQuestion } from "../../shared/types.ts";

export interface GalleryData {
  items: { story: Story; versions: MockupVersion[] }[];
  missingIds: string[];
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({ error: `Server vastas veaga ${res.status}` }));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Viga ${res.status}`);
  return data as T;
}

export interface StoryPatchBody {
  role?: string;
  action?: string;
  benefit?: string;
  status?: StoryStatus;
  size?: StorySize | null;
  isView?: boolean;
  openQuestions?: OpenQuestion[];
  criteria?: CriterionDraft[];
}

export const api = {
  listProjects: () => request<ProjectSummary[]>("GET", "/api/projects"),
  createProject: (name: string, description: string) => request<ProjectState>("POST", "/api/projects", { name, description }),
  deleteProject: (id: string) => request<void>("DELETE", `/api/projects/${id}`),
  getProject: (id: string) => request<ProjectState>("GET", `/api/projects/${id}`),
  patchProject: (id: string, body: { name?: string; description?: string; mvpLine?: number | null }) => request<ProjectState>("PATCH", `/api/projects/${id}`, body),
  chat: (id: string, action: ChatAction) => request<ProjectState>("POST", `/api/projects/${id}/chat`, action),
  addStory: (id: string, body: { role: string; action: string; benefit: string; size?: StorySize | null; isView?: boolean }) =>
    request<ProjectState>("POST", `/api/projects/${id}/stories`, body),
  patchStory: (id: string, storyId: string, body: StoryPatchBody) => request<ProjectState>("PATCH", `/api/projects/${id}/stories/${storyId}`, body),
  deleteStory: (id: string, storyId: string) => request<ProjectState>("DELETE", `/api/projects/${id}/stories/${storyId}`),
  reorder: (id: string, orderedIds: string[]) => request<ProjectState>("POST", `/api/projects/${id}/reorder`, { orderedIds }),
  split: (id: string, storyId: string, parts: StoryDraft[]) => request<ProjectState>("POST", `/api/projects/${id}/stories/${storyId}/split`, { parts }),
  merge: (id: string, storyIds: string[], merged: StoryDraft) => request<ProjectState>("POST", `/api/projects/${id}/merge`, { storyIds, merged }),
  mockupVersions: (id: string, storyId: string) => request<MockupVersion[]>("GET", `/api/projects/${id}/stories/${storyId}/mockups`),
  restoreMockup: (id: string, storyId: string, mockupId: string) =>
    request<ProjectState>("POST", `/api/projects/${id}/stories/${storyId}/mockups/restore`, { mockupId }),
  gallery: (id: string) => request<GalleryData>("GET", `/api/projects/${id}/gallery`),
  exportGallery: (id: string) => request<{ dir: string; files: string[]; count: number }>("POST", `/api/projects/${id}/export/gallery`),
  undo: (id: string) => request<ProjectState & { undone: string }>("POST", `/api/projects/${id}/undo`),
};
