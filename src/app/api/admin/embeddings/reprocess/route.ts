import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAuthorizedSession } from "@/lib/security/authorization";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { logger } from "@/lib/observability/logger";

/**
 * Route Handler administrativo para reprocessar em lote embeddings pendentes.
 * Apenas administradores têm acesso.
 */
export async function POST(_request: NextRequest) {
  let adminUid = "unknown";
  try {
    // 1. Valida se o usuário tem perfil de administrador
    const authSession = await getAuthorizedSession(["administrator"]);
    if (!authSession) {
      return NextResponse.json(
        { error: "Acesso negado. Apenas administradores podem acionar a conciliação de embeddings." },
        { status: 403 }
      );
    }

    adminUid = authSession.sessionUser.uid;
    const db = getAdminFirestore();

    // 2. Localiza itens publicados que estão com embedding pendente (embeddingVersion == 0)
    const pendingSnapshot = await db
      .collection("knowledgeItems")
      .where("reviewStatus", "==", "published")
      .where("deletedAt", "==", null)
      .where("embeddingVersion", "==", 0)
      .limit(10) // Processamos no máximo 10 por lote para evitar estouros de tempo limite e cotas
      .get();

    if (pendingSnapshot.empty) {
      logger.info("Nenhum embedding pendente localizado para reprocessamento.", { adminUid });
      return NextResponse.json({ success: true, processedCount: 0 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
    const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

    let processedCount = 0;

    for (const docSnap of pendingSnapshot.docs) {
      const data = docSnap.data();
      const id = docSnap.id;

      const title = data.title || "";
      const summary = data.summary || "";
      const content = data.content || "";
      const tags = Array.isArray(data.tags) ? data.tags.join(", ") : "";
      const textToEmbed = `${title}\n${summary}\n${content}\nTags: ${tags}`;

      let embedding: number[];

      if (!ai || (isEmulator && !apiKey)) {
        embedding = new Array(768).fill(0).map(() => Math.random() * 0.1);
      } else {
        if (!apiKey) {
          throw new Error("GEMINI_API_KEY não configurada no servidor.");
        }
        const response = await ai.models.embedContent({
          model: "gemini-embedding-2",
          contents: textToEmbed,
          config: {
            outputDimensionality: 768,
          },
        });
        if (!response.embeddings?.[0]?.values) {
          logger.warn("Gemini retornou vetor inválido durante reprocessamento", { itemId: id });
          continue;
        }
        embedding = response.embeddings[0].values;
      }

      await db.collection("knowledgeItems").doc(id).update({
        embedding: FieldValue.vector(embedding),
        embeddingVersion: 1,
        updatedAt: FieldValue.serverTimestamp(),
      });

      processedCount++;
      logger.info("Embedding reprocessado com sucesso via conciliação", { itemId: id, adminUid });
    }

    return NextResponse.json({ success: true, processedCount });
  } catch (error) {
    logger.error("Erro na conciliação de embeddings", { adminUid }, error);
    const mappedError = mapFirebaseError(error);
    return NextResponse.json(
      { error: mappedError.message || "Erro interno ao processar conciliação de embeddings." },
      { status: 500 }
    );
  }
}
