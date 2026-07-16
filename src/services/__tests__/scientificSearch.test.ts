import { describe, it, expect, vi } from "vitest";
import { searchScientificReferences } from "../scientificSearch";

describe("searchScientificReferences", () => {
  it("deve buscar referências científicas reais com sucesso usando Europe PMC", async () => {
    // Usamos a chave de API real do ambiente de testes se disponível
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      console.warn("GEMINI_API_KEY não disponível. Pulando teste de integração real.");
      return;
    }

    const query = "Qual a eficácia de intervenções comportamentais na ecolalia?";
    const results = await searchScientificReferences(query, apiKey);

    // Deve retornar uma lista de artigos
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    // Cada artigo deve possuir os campos estruturados obrigatórios
    const firstArticle = results[0];
    expect(firstArticle).toBeDefined();
    expect(firstArticle?.title).toBeTypeOf("string");
    expect(firstArticle?.authors).toBeTypeOf("string");
    expect(firstArticle?.journal).toBeTypeOf("string");
    expect(firstArticle?.year).toBeTypeOf("string");
    expect(firstArticle?.url).toBeTypeOf("string");
    expect(firstArticle?.abstractText).toBeTypeOf("string");

    console.log("[Teste de Integração] Sucesso ao buscar artigo:", firstArticle?.title);
  });

  it("deve lidar de forma robusta e retornar array vazio quando a chamada da API do Europe PMC falhar", async () => {
    // Mock global de fetch para simular falha
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(() => Promise.reject(new Error("Network Error")));

    const apiKey = "mock-api-key";
    const results = await searchScientificReferences("any query", apiKey);

    expect(results).toEqual([]);

    // Restaura o fetch original
    global.fetch = originalFetch;
  });
});
