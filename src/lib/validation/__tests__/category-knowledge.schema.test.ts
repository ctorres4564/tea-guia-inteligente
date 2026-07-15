import { describe, expect, it } from "vitest";

import { categorySchema } from "@/lib/validation/category.schema";
import { knowledgeItemSchema } from "@/lib/validation/knowledge.schema";

describe("categorySchema", () => {
  it("exige slug em kebab-case", () => {
    const valid = categorySchema.safeParse({
      id: "1",
      name: "Comunicação",
      slug: "comunicacao",
      status: "published",
      displayOrder: 0,
      createdAt: null,
      updatedAt: null,
    });
    expect(valid.success).toBe(true);

    const invalid = categorySchema.safeParse({
      id: "1",
      name: "Comunicação",
      slug: "Comunicação Errada",
      status: "published",
      displayOrder: 0,
      createdAt: null,
      updatedAt: null,
    });
    expect(invalid.success).toBe(false);
  });
});

describe("knowledgeItemSchema", () => {
  it("exige ao menos um público-alvo", () => {
    const result = knowledgeItemSchema.safeParse({
      id: "1",
      categoryId: "cat-1",
      title: "O que é ecolalia?",
      slug: "o-que-e-ecolalia",
      summary: "Resumo curto.",
      content: "Conteúdo completo.",
      targetAudience: [],
      tags: [],
      evidenceLevel: "moderate",
      reviewStatus: "draft",
      createdBy: "uid-1",
      createdAt: null,
      updatedAt: null,
    });
    expect(result.success).toBe(false);
  });
});
