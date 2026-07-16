import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getActiveSession } from "@/lib/security/authorization";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { knowledgeItemSchema } from "@/lib/validation/knowledge.schema";

const SIMILARITY_THRESHOLD = 0.50; // Limiar mais generoso para relacionados

/**
 * Route Handler para obter conteúdos clinicamente relacionados (busca vetorial).
 * Apenas usuários autenticados e ativos têm acesso.
 *
 * Aceita payload JSON com:
 * - itemId: ID do item atual para o qual encontrar relacionados (string, obrigatório)
 * - limit: limite de resultados (default 3)
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Valida autenticação
    const activeSession = await getActiveSession();
    if (!activeSession) {
      return NextResponse.json(
        { error: "Acesso negado. Requer autenticação e conta ativa." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { itemId } = body;
    const limit = typeof body.limit === "number" ? Math.min(10, Math.max(1, body.limit)) : 3;

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json(
        { error: "O parâmetro 'itemId' é obrigatório." },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();

    // 2. Busca o item de referência
    const itemSnap = await db.collection("knowledgeItems").doc(itemId).get();
    if (!itemSnap.exists) {
      return NextResponse.json(
        { error: "Artigo de referência não encontrado." },
        { status: 404 }
      );
    }

    const itemData = itemSnap.data();
    if (!itemData) {
      return NextResponse.json({ results: [] });
    }

    const itemEmbedding = itemData.embedding;

    // Se não tiver embedding (ex: rascunho recém-editado localmente ou mock), tentamos achar por tags
    if (!itemEmbedding || !Array.isArray(itemEmbedding)) {
      const tags = (itemData.tags || []) as string[];
      if (tags.length === 0) {
        return NextResponse.json({ results: [] });
      }

      // Fallback por tags comuns
      const fallbackQuery = await db
        .collection("knowledgeItems")
        .where("reviewStatus", "==", "published")
        .where("deletedAt", "==", null)
        .where("tags", "array-contains-any", tags.slice(0, 10))
        .limit(limit + 1)
        .get();

      const results = fallbackQuery.docs
        .map((docSnap) => {
          const parsed = knowledgeItemSchema.safeParse({ id: docSnap.id, ...docSnap.data() });
          return parsed.success ? parsed.data : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .filter((item) => item.id !== itemId)
        .slice(0, limit)
        .map((item) => {
          const clean = { ...item };
          delete (clean as any).embedding;
          return { ...clean, similarity: 0.70 }; // Similaridade arbitrária de fallback
        });

      return NextResponse.json({ results });
    }

    // 3. Executa busca vetorial KNN baseada no embedding do item
    const queryBase = db
      .collection("knowledgeItems")
      .where("reviewStatus", "==", "published")
      .where("deletedAt", "==", null);

    const vectorQuery = queryBase.findNearest({
      vectorField: "embedding",
      queryVector: FieldValue.vector(itemEmbedding),
      limit: limit + 5, // Puxa um pouco a mais para podermos excluir o próprio item
      distanceMeasure: "COSINE",
      distanceResultField: "searchDistance",
    });

    const snapshot = await vectorQuery.get();

    let results = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        const distance = data.searchDistance ?? 1.0;
        const similarity = 1 - distance;

        const parsed = knowledgeItemSchema.safeParse({ id: docSnap.id, ...data });
        if (!parsed.success) return null;

        const item = parsed.data;
        if (item.id === itemId) return null; // Exclui o próprio item

        const cleanItem = { ...item };
        delete (cleanItem as any).embedding;

        return {
          ...cleanItem,
          similarity,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => item.similarity >= SIMILARITY_THRESHOLD);

    // Ordena decrescente
    results.sort((a, b) => b.similarity - a.similarity);
    results = results.slice(0, limit);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Erro ao obter conteúdos relacionados:", error);
    const mappedError = mapFirebaseError(error);
    return NextResponse.json(
      { error: mappedError.message || "Erro interno ao buscar conteúdos relacionados." },
      { status: 500 }
    );
  }
}
