import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getActiveSession } from "@/lib/security/authorization";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { knowledgeItemSchema } from "@/lib/validation/knowledge.schema";

const SIMILARITY_THRESHOLD = 0.65; // Similaridade de cosseno mínima aceitável (equivale a distância máxima de 0.35)

/**
 * Route Handler para busca semântica de fichas clínicas da base de conhecimento.
 * Apenas usuários autenticados e ativos podem pesquisar.
 *
 * Aceita payload JSON com:
 * - q: termo de pesquisa (string, obrigatório)
 * - categoryId: ID da categoria para filtrar (string, opcional)
 * - targetAudience: público-alvo para filtrar (string, opcional)
 * - ageRange: faixa etária para filtrar (string, opcional)
 * - limit: número máximo de resultados (number, opcional, default 10)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Valida autenticação e conta ativa no servidor
    const activeSession = await getActiveSession();
    if (!activeSession) {
      return NextResponse.json(
        { error: "Acesso negado. É necessário estar autenticado e com conta ativa para realizar buscas." },
        { status: 401 }
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

    if (!apiKey && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
      // Mock de vetor para desenvolvimento local sem chave do Gemini
      queryEmbedding = new Array(768).fill(0).map(() => Math.random() * 0.1);
    } else {
      if (!apiKey) {
        return NextResponse.json(
          { error: "Chave GEMINI_API_KEY não configurada no servidor." },
          { status: 500 }
        );
      }

      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.embedContent({
          model: "text-embedding-004",
          contents: q.trim(),
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
      }
    }

    // 4. Consulta vetorial KNN no Firestore via Admin SDK
    const db = getAdminFirestore();
    const queryBase = db
      .collection("knowledgeItems")
      .where("reviewStatus", "==", "published")
      .where("deletedAt", "==", null);

    // Buscamos um número maior de itens para permitir filtragem em memória no servidor
    const vectorQuery = queryBase.findNearest({
      vectorField: "embedding",
      queryVector: FieldValue.vector(queryEmbedding),
      limit: Math.max(30, limit * 3),
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

        const parsed = knowledgeItemSchema.safeParse({ id: docSnap.id, ...data });
        if (!parsed.success) return null;

        const item = parsed.data;
        // Remove a propriedade embedding da resposta enviada via JSON
        const cleanItem = { ...item };
        delete (cleanItem as any).embedding;

        return {
          ...cleanItem,
          similarity,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // 6. Aplica filtros em memória (Pós-filtragem para otimização de índices do Firestore)
    if (categoryId && typeof categoryId === "string") {
      results = results.filter((item) => item.categoryId === categoryId);
    }

    if (targetAudience && typeof targetAudience === "string") {
      results = results.filter((item) => {
        const audiences: string[] = item.targetAudience || [];
        return audiences.includes(targetAudience);
      });
    }

    if (ageRange && typeof ageRange === "string") {
      results = results.filter((item) => {
        const itemAge: string = item.ageRange || "";
        return itemAge.toLowerCase().includes(ageRange.toLowerCase());
      });
    }

    // Filtra pelo limiar mínimo de corte de similaridade
    results = results.filter((item) => item.similarity >= SIMILARITY_THRESHOLD);

    // Ordena de forma decrescente pela similaridade e trunca conforme o limite
    results.sort((a, b) => b.similarity - a.similarity);
    results = results.slice(0, limit);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Erro no Route Handler de busca semântica:", error);
    const mappedError = mapFirebaseError(error);
    return NextResponse.json(
      { error: mappedError.message || "Erro interno ao processar a busca." },
      { status: 500 }
    );
  }
}
