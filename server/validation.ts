// Brauserist tulevate päringute kontroll.
import { z } from "zod";
import { MockupSchema } from "./ai/schemas.ts";
import { SIZES, STAGES, STATUSES } from "../shared/types.ts";

const text = (max = 2000) => z.string().trim().max(max);
const id = z.string().min(1).max(100);

export const CriterionDraftSchema = z.object({ text: text(500), elementIds: z.array(z.string().max(50)).max(50).default([]) });

export const StoryDraftSchema = z.object({
  role: text(200),
  action: text(500),
  benefit: text(500),
  size: z.enum(SIZES),
  isView: z.boolean(),
  criteria: z.array(text(500)).max(30),
});

export const ChangeAfterSchema = z.object({
  role: text(200),
  action: text(500),
  benefit: text(500),
  criteria: z.array(CriterionDraftSchema).max(30),
  mockup: MockupSchema.nullable(),
});

const RoleSchema = z.object({ name: text(100).min(1), description: text(500).default("") });

export const ChatActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: text(4000).min(1) }),
  z.object({ type: z.literal("answer"), questionId: id, values: z.array(text(500)).min(1).max(10) }),
  z.object({ type: z.literal("skip_question"), questionId: id }),
  z.object({ type: z.literal("propose_roles") }),
  z.object({ type: z.literal("confirm_roles"), proposalId: id, roles: z.array(RoleSchema).min(1).max(12) }),
  z.object({ type: z.literal("propose_stories"), feedback: text(1000).optional() }),
  z.object({ type: z.literal("add_stories"), proposalId: id, indices: z.array(z.number().int().min(0)).max(30) }),
  z.object({ type: z.literal("recommend_priority") }),
  z.object({ type: z.literal("choose_focus"), storyId: id, moveToTop: z.boolean().optional() }),
  z.object({ type: z.literal("pick_focus") }),
  z.object({ type: z.literal("propose_criteria"), storyId: id }),
  z.object({ type: z.literal("apply_criteria"), proposalId: id, criteria: z.array(CriterionDraftSchema).max(30), includeMockup: z.boolean() }),
  z.object({ type: z.literal("refine"), storyId: id, text: text(4000).min(1) }),
  z.object({ type: z.literal("apply_change"), proposalId: id, edited: ChangeAfterSchema.optional() }),
  z.object({ type: z.literal("reject_proposal"), proposalId: id }),
  z.object({ type: z.literal("next_story") }),
  z.object({ type: z.literal("review") }),
  z.object({ type: z.literal("apply_finding"), proposalId: id, index: z.number().int().min(0), edited: z.array(StoryDraftSchema).max(10).optional() }),
  z.object({ type: z.literal("ignore_finding"), proposalId: id, index: z.number().int().min(0) }),
  z.object({ type: z.literal("new_view"), text: text(4000).min(1) }),
  z.object({ type: z.literal("apply_new_view"), proposalId: id }),
  z.object({ type: z.literal("goto_stage"), stage: z.enum(STAGES) }),
  z.object({ type: z.literal("end_meeting") }),
  z.object({ type: z.literal("resume") }),
]);

export const ProjectCreateSchema = z.object({ name: text(200).min(1, "Projekti nimi on kohustuslik"), description: text(2000).default("") });
export const ProjectPatchSchema = z.object({
  name: text(200).min(1).optional(),
  description: text(2000).optional(),
  mvpLine: z.number().int().min(0).nullable().optional(),
});

export const StoryCreateSchema = z.object({
  role: text(200),
  action: text(500),
  benefit: text(500),
  size: z.enum(SIZES).nullable().optional(),
  isView: z.boolean().optional(),
  index: z.number().int().min(0).optional(),
});

export const StoryPatchSchema = z.object({
  role: text(200).optional(),
  action: text(500).optional(),
  benefit: text(500).optional(),
  status: z.enum(STATUSES).optional(),
  size: z.enum(SIZES).nullable().optional(),
  isView: z.boolean().optional(),
  openQuestions: z.array(z.object({ id: id, text: text(500).min(1) })).max(30).optional(),
  criteria: z.array(CriterionDraftSchema).max(30).optional(),
});

export const ReorderSchema = z.object({ orderedIds: z.array(id).max(500) });
export const SplitSchema = z.object({ parts: z.array(StoryDraftSchema).min(2).max(10) });
export const MergeSchema = z.object({ storyIds: z.array(id).min(2).max(10), merged: StoryDraftSchema });
export const MockupRestoreSchema = z.object({ mockupId: id });
