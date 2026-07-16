import { describe, expect, it } from "vitest";

import {
  childProfileFormSchema,
  childProfileSchema,
} from "@/lib/validation/child-profile.schema";

const BASE_CHILD = {
  id: "1",
  name: "Miguel",
  birthDate: "2020-05-10",
  diagnosisStatus: "diagnosed",
  supportLevel: "level_2",
  communicationStyle: "uses_aac",
  interests: ["dinossauros", "música"],
  sensitivities: ["sons altos"],
  notes: "",
  createdAt: null,
  updatedAt: null,
};

describe("childProfileSchema", () => {
  it("aceita um perfil válido completo", () => {
    const result = childProfileSchema.safeParse(BASE_CHILD);
    expect(result.success).toBe(true);
  });

  it("aceita um perfil mínimo (sem diagnóstico)", () => {
    const result = childProfileSchema.safeParse({
      ...BASE_CHILD,
      diagnosisStatus: "not_diagnosed",
      supportLevel: null,
      communicationStyle: null,
      interests: [],
      sensitivities: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita data de nascimento em formato inválido", () => {
    const result = childProfileSchema.safeParse({ ...BASE_CHILD, birthDate: "10/05/2020" });
    expect(result.success).toBe(false);
  });

  it("rejeita data de nascimento no futuro", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const isoFuture = futureDate.toISOString().slice(0, 10);

    const result = childProfileSchema.safeParse({ ...BASE_CHILD, birthDate: isoFuture });
    expect(result.success).toBe(false);
  });

  it("rejeita nome vazio", () => {
    const result = childProfileSchema.safeParse({ ...BASE_CHILD, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita status diagnóstico inválido", () => {
    const result = childProfileSchema.safeParse({ ...BASE_CHILD, diagnosisStatus: "cured" });
    expect(result.success).toBe(false);
  });

  it("limita a no máximo 10 interesses", () => {
    const manyInterests = Array.from({ length: 11 }, (_, i) => `interesse-${i}`);
    const result = childProfileSchema.safeParse({ ...BASE_CHILD, interests: manyInterests });
    expect(result.success).toBe(false);
  });
});

describe("childProfileFormSchema", () => {
  it("não exige id nem timestamps", () => {
    const result = childProfileFormSchema.safeParse({
      name: "Ana",
      birthDate: "2019-01-01",
      diagnosisStatus: "in_evaluation",
      interests: [],
      sensitivities: [],
      notes: "",
    });
    expect(result.success).toBe(true);
  });
});
