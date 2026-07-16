import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { searchScientificReferences } from "@/services/scientificSearch";

export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getActiveSession } from "@/lib/security/authorization";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { knowledgeItemSchema } from "@/lib/validation/knowledge.schema";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit } from "@/lib/security/rate-limit";

const SIMILARITY_THRESHOLD = 0.65; // Similaridade de cosseno mínima aceitável (equivale a distância máxima de 0.35)
const RATE_LIMIT_CONFIG = { maxRequests: 40, windowMs: 60_000 };

/**
 * Helper para verificar se a idade buscada corresponde à faixa etária do item.
 */
function matchAge(itemAge: string | undefined | null, searchAge: string): boolean {
  if (!itemAge) return false;

  const cleanSearch = searchAge.trim().toLowerCase();
  const cleanItem = itemAge.trim().toLowerCase();

  if (
    cleanItem.includes("todas") ||
    cleanItem.includes("qualquer") ||
    cleanItem.includes("livre") ||
    cleanItem.includes("todos")
  ) {
    return true;
  }

  const searchNumMatch = cleanSearch.match(/\d+/);
  if (!searchNumMatch) {
    return cleanItem.includes(cleanSearch);
  }
  const searchNum = parseInt(searchNumMatch[0], 10);

  const rangeMatch = cleanItem.match(/(\d+)\s*(?:a|-)\s*(\d+)/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    return searchNum >= min && searchNum <= max;
  }

  if (cleanItem.includes("até") || cleanItem.includes("menos de")) {
    const numMatch = cleanItem.match(/\d+/);
    if (numMatch) {
      const limit = parseInt(numMatch[0], 10);
      return searchNum <= limit;
    }
  }

  if (
    cleanItem.includes("a partir de") ||
    cleanItem.includes("mais de") ||
    cleanItem.includes("acima de")
  ) {
    const numMatch = cleanItem.match(/\d+/);
    if (numMatch) {
      const limit = parseInt(numMatch[0], 10);
      return searchNum >= limit;
    }
  }

  const itemNumMatch = cleanItem.match(/\d+/);
  if (itemNumMatch) {
    const itemNum = parseInt(itemNumMatch[0], 10);
    return searchNum === itemNum;
  }

  return cleanItem.includes(cleanSearch);
}

/**
 * Route Handler para busca semântica de fichas clínicas da base de conhecimento.
 * Apenas usuários autenticados e ativos podem pesquisar.
 */
export async function POST(request: NextRequest) {
  let userId = "unknown";
  try {
    // 1. Valida autenticação e conta ativa no servidor
    const activeSession = await getActiveSession();
    if (!activeSession) {
      return NextResponse.json(
        { error: "Acesso negado. É necessário estar autenticado e com conta ativa para realizar buscas." },
        { status: 401 }
      );
    }

    // 1b. Rate limit centralizado (40 requisições/min)
    const { sessionUser } = activeSession;
    userId = sessionUser.uid;
    const rateLimitRes = checkRateLimit(`search:${userId}`, RATE_LIMIT_CONFIG);
    if (!rateLimitRes.success) {
      logger.warn("Search rate limit exceeded", { userId: sessionUser.uid });
      return NextResponse.json(
        { error: "Limite de requisições excedido. Aguarde 1 minuto." },
        { status: 429 }
      );
    }

    // 2. Extrai e valida os parâmetros do body
    const body = await request.json().catch(() => ({}));
    const { q, categoryId, targetAudience, ageRange } = body;
    const limit = typeof body.limit === "number" ? Math.min(20, Math.max(1, body.limit)) : 10;

    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return NextResponse.json(
        { error: "O parâmetro de pesquisa 'q' é obrigatório e deve ter no mínimo 2 caracteres." },
        { status: 400 }
      );
    }

    if (q.trim().length > 500) {
      return NextResponse.json(
        { error: "O parâmetro de pesquisa 'q' não pode exceder 500 caracteres." },
        { status: 400 }
      );
    }

    // 3. Gera o embedding do termo de busca usando a API do Gemini
    let queryEmbedding: number[];
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey && (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" || process.env.NODE_ENV === "development")) {
      // Mock de vetor para desenvolvimento local sem chave do Gemini
      queryEmbedding = new Array(768).fill(0).map(() => Math.random() * 0.1);
    } else {
      if (!apiKey) {
        return NextResponse.json(
          { error: "Chave GEMINI_API_KEY não configurada no servidor." },
          { status: 500 }
        );
      }

      const backup = {
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID,
        GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
        GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
      };

      try {
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
        delete process.env.FIREBASE_ADMIN_PROJECT_ID;
        delete process.env.GCLOUD_PROJECT;
        delete process.env.GOOGLE_CLOUD_PROJECT;

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.embedContent({
          model: "gemini-embedding-2",
          contents: q.trim(),
          config: {
            outputDimensionality: 768,
          },
        });

        if (!response.embeddings?.[0]?.values) {
          return NextResponse.json(
            { error: "Erro ao gerar representação vetorial da pesquisa." },
            { status: 502 }
          );
        }

        queryEmbedding = response.embeddings[0].values;
      } catch (err) {
        console.error("Erro ao gerar embedding de pesquisa:", err);
        return NextResponse.json(
          { error: "Falha na comunicação com o serviço de embeddings da IA." },
          { status: 502 }
        );
      } finally {
        Object.keys(backup).forEach((key) => {
          const val = backup[key as keyof typeof backup];
          if (val !== undefined) {
            process.env[key] = val;
          }
        });
      }
    }

    // 4. Consulta vetorial KNN no Firestore via Admin SDK
    const db = getAdminFirestore();
    const queryBase = db
      .collection("knowledgeItems")
      .where("reviewStatus", "==", "published")
      .where("deletedAt", "==", null);

    // Buscamos uma janela KNN maior que o limite final para compensar a perda
    // pela pós-filtragem em memória (categoria, público-alvo, faixa etária).
    //
    // Risco documentado: com muitos filtros combinados, mesmo a janela ampliada
    // pode retornar vazio se os itens mais semânticos não corresponderem aos filtros.
    // Mitigação futura: usar composite indexes no Firestore para pré-filtrar antes
    // do KNN (requer reestruturação de índices — ver ROADMAP Fase 7+).
    //
    // Janela escolhida: Math.max(50, limit * 5)
    //   - Sem filtros: 50 itens candidatos para selecionar os melhores `limit`
    //   - Com filtros: a janela absorve ~80% de descarte e ainda retorna resultados
    const vectorQuery = queryBase.findNearest({
      vectorField: "embedding",
      queryVector: FieldValue.vector(queryEmbedding),
      limit: Math.max(50, limit * 5),
      distanceMeasure: "COSINE",
      distanceResultField: "searchDistance",
    });

    const snapshot = await vectorQuery.get();

    // 5. Mapeia e calcula pontuações de similaridade
    let results = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        const distance = data.searchDistance ?? 1.0;
        const similarity = 1 - distance; // Similaridade de cosseno: 1 = idênticos, 0 = opostos/ortogonais

        // Remove o VectorValue do Firestore antes de validar para não quebrar a tipagem do Zod
        const dataToValidate = { ...data };
        delete dataToValidate.embedding;

        const parsed = knowledgeItemSchema.safeParse({ id: docSnap.id, ...dataToValidate });
        if (!parsed.success) return null;

        const item = parsed.data;
        const cleanItem = { ...item };

        return {
          ...cleanItem,
          similarity,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // 6. Aplica filtros em memória com estratégias de fallback gradual
    const applyFilters = (
      items: typeof results,
      useCategory: boolean,
      useAudience: boolean,
      useAge: boolean,
      minSimilarity: number
    ) => {
      let filtered = [...items];

      if (useCategory && categoryId && typeof categoryId === "string") {
        filtered = filtered.filter((item) => item.categoryId === categoryId);
      }

      if (useAudience && targetAudience && typeof targetAudience === "string") {
        filtered = filtered.filter((item) => {
          const audiences: string[] = item.targetAudience || [];
          return audiences.includes(targetAudience);
        });
      }

      if (useAge && ageRange && typeof ageRange === "string") {
        filtered = filtered.filter((item) => matchAge(item.ageRange, ageRange));
      }

      filtered = filtered.filter((item) => item.similarity >= minSimilarity);
      return filtered;
    };

    // Tenta primeiro com todos os filtros estritamente aplicados
    let filteredResults = applyFilters(results, true, true, true, SIMILARITY_THRESHOLD);
    let filtersRelaxed: string[] = [];

    if (filteredResults.length === 0) {
      // 1. Remove filtro de idade
      if (ageRange) {
        filteredResults = applyFilters(results, true, true, false, SIMILARITY_THRESHOLD);
        if (filteredResults.length > 0) {
          filtersRelaxed.push("ageRange");
        }
      }

      // 2. Remove também o filtro de público-alvo
      if (filteredResults.length === 0 && targetAudience) {
        filteredResults = applyFilters(results, true, false, false, SIMILARITY_THRESHOLD);
        if (filteredResults.length > 0) {
          filtersRelaxed = ageRange ? ["ageRange", "targetAudience"] : ["targetAudience"];
        }
      }

      // 3. Remove também a categoria (busca semântica livre)
      if (filteredResults.length === 0 && categoryId) {
        filteredResults = applyFilters(results, false, false, false, SIMILARITY_THRESHOLD);
        if (filteredResults.length > 0) {
          filtersRelaxed = [];
          if (ageRange) filtersRelaxed.push("ageRange");
          if (targetAudience) filtersRelaxed.push("targetAudience");
          filtersRelaxed.push("categoryId");
        }
      }

      // 4. Reduz similaridade de corte para capturar correspondências mais distantes (0.45)
      if (filteredResults.length === 0) {
        filteredResults = applyFilters(results, false, false, false, 0.45);
        if (filteredResults.length > 0) {
          filtersRelaxed = ["similarity"];
          if (ageRange) filtersRelaxed.push("ageRange");
          if (targetAudience) filtersRelaxed.push("targetAudience");
          if (categoryId) filtersRelaxed.push("categoryId");
        }
      }
    }

    // Busca referências na internet (Europe PMC) se a chave estiver presente e for uma busca textual
    let externalResults: any[] = [];
    if (apiKey && q && q.trim().length >= 2) {
      try {
        const externalRefs = await searchScientificReferences(q, apiKey);
        externalResults = externalRefs.map((art, idx) => ({
          id: `ext-${idx}-${Date.now()}`,
          title: `[Internet] ${art.title}`,
          slug: `external-${idx}`,
          summary: `${art.authors} (${art.year}) - ${art.journal}`,
          content: art.abstractText,
          evidenceLevel: "high",
          targetAudience: ["general"],
          ageRange: "Todas as idades",
          similarity: 0.8, // Similaridade mockada para ficar bem posicionado
          url: art.url,
          external: true,
        }));
      } catch (err) {
        console.error("Erro ao buscar referências externas para busca do dashboard:", err);
      }
    }

    // Ordena de forma decrescente pela similaridade e trunca conforme o limite
    let combinedResults = [...filteredResults, ...externalResults];
    combinedResults.sort((a, b) => b.similarity - a.similarity);
    combinedResults = combinedResults.slice(0, limit);

    return NextResponse.json({
      results: combinedResults,
      filtersRelaxed: filtersRelaxed.length > 0 ? filtersRelaxed : undefined
    });
  } catch (error) {
    logger.error("Erro no Route Handler de busca semântica", { userId }, error);
    const mappedError = mapFirebaseError(error);
    return NextResponse.json(
      { error: mappedError.message || "Erro interno ao processar a busca." },
      { status: 500 }
    );
  }
}
