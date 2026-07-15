import { z } from "zod";

export const evidenceLevelSchema = z.enum(["low", "moderate", "high", "expert_consensus"]);
export type EvidenceLevel = z.infer<typeof evidenceLevelSchema>;

export const reviewStatusSchema = z.enum(["draft", "in_review", "approved", "published", "rejected"]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const targetAudienceSchema = z.enum([
  "family",
  "educator",
  "professional",
  "general",
]);
export type TargetAudience = z.infer<typeof targetAudienceSchema>;

export const knowledgeAttachmentSchema = z.object({
  path: z.string().min(1),
  url: z.string().url(),
  name: z.string().min(1),
});
export type KnowledgeAttachment = z.infer<typeof knowledgeAttachmentSchema>;

/**
 * Modelagem da coleção `knowledgeItems`.
 * CRUD administrativo, fluxo de revisão e versionamento implementados na Fase 2
 * (ver `src/domains/knowledge/service.ts`).
 */
export const knowledgeItemSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  title: z.string().trim().min(3).max(160),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug deve estar em kebab-case"),
  summary: z.string().trim().max(400),
  content: z.string().trim().min(1),
  targetAudience: z.array(targetAudienceSchema).nonempty(),
  ageRange: z.string().trim().max(40).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  evidenceLevel: evidenceLevelSchema,
  reviewStatus: reviewStatusSchema,
  version: z.number().int().positive().default(1),
  publishedAt: z.unknown().nullable().optional(),
  createdBy: z.string().min(1),
  reviewedBy: z.string().nullable().optional(),
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
  deletedAt: z.unknown().nullable().optional(),
  attachments: z.array(knowledgeAttachmentSchema).default([]),
});
export type KnowledgeItem = z.infer<typeof knowledgeItemSchema>;

export const sourceTypeSchema = z.enum([
  "article",
  "guideline",
  "book",
  "official_document",
  "systematic_review",
  "other",
]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const knowledgeSourceSchema = z.object({
  id: z.string().min(1),
  knowledgeItemId: z.string().min(1),
  title: z.string().trim().min(3).max(300),
  authors: z.array(z.string().trim().min(1)).default([]),
  publication: z.string().trim().max(200).optional(),
  publicationYear: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),
  url: z.string().url().optional(),
  doi: z.string().trim().max(120).optional(),
  sourceType: sourceTypeSchema,
  createdAt: z.unknown(),
});
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;
