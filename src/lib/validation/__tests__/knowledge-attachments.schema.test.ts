import { describe, expect, it } from "vitest";

import { knowledgeAttachmentSchema, knowledgeItemSchema } from "@/lib/validation/knowledge.schema";

const BASE_ITEM = {
  id: "1",
  categoryId: "cat-1",
  title: "O que é ecolalia?",
  slug: "o-que-e-ecolalia",
  summary: "Resumo curto.",
  content: "Conteúdo completo.",
  targetAudience: ["family"],
  tags: [],
  evidenceLevel: "moderate",
  reviewStatus: "draft",
  createdBy: "uid-1",
  createdAt: null,
  updatedAt: null,
};

describe("knowledgeAttachmentSchema", () => {
  it("exige path, url e name", () => {
    const result = knowledgeAttachmentSchema.safeParse({
      path: "knowledge/1/arquivo.pdf",
      url: "https://example.com/arquivo.pdf",
      name: "arquivo.pdf",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita url inválida", () => {
    const result = knowledgeAttachmentSchema.safeParse({
      path: "knowledge/1/arquivo.pdf",
      url: "not-a-url",
      name: "arquivo.pdf",
    });
    expect(result.success).toBe(false);
  });
});

describe("knowledgeItemSchema.attachments", () => {
  it("aceita item sem attachments (usa default [])", () => {
    const result = knowledgeItemSchema.safeParse(BASE_ITEM);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attachments).toEqual([]);
    }
  });

  it("aceita item com attachments válidos", () => {
    const result = knowledgeItemSchema.safeParse({
      ...BASE_ITEM,
      attachments: [
        { path: "knowledge/1/a.pdf", url: "https://example.com/a.pdf", name: "a.pdf" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
