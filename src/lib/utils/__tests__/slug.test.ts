import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/utils/slug";

describe("slugify", () => {
  it("remove acentos e converte para kebab-case", () => {
    expect(slugify("O que é Ecolalia?")).toBe("o-que-e-ecolalia");
  });

  it("colapsa espaços e símbolos em um único hífen", () => {
    expect(slugify("Comunicação & Fala   —  Guia")).toBe("comunicacao-fala-guia");
  });

  it("remove hífens nas extremidades", () => {
    expect(slugify("  -Teste-  ")).toBe("teste");
  });

  it("produz um slug compatível com a validação dos schemas (kebab-case)", () => {
    const slug = slugify("Título de Exemplo 123");
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});
