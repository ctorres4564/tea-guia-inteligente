import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAuthorizedSession, REVIEWER_ROLES } from "@/lib/security/authorization";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";

/**
 * Route Handler para publicação de conteúdos clínicos.
 * Roda estritamente no servidor, garantindo a proteção da chave do Gemini
 * e a consistência da geração do embedding antes do salvamento da ficha.
 *
 * Apenas usuários com papéis reviewer ou administrator podem publicar.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Valida se o usuário tem privilégios de revisor ou administrador
    const authSession = await getAuthorizedSession(REVIEWER_ROLES);
    if (!authSession) {
      return NextResponse.json(
        { error: "Acesso negado. Apenas revisores e administradores podem publicar conteúdos." },
        { status: 403 }
      );
    }

    const { sessionUser } = authSession;

    // 2. Extrai e valida o ID do item
    const body = await request.json();
    const { id } = body;
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "O ID do item é obrigatório e deve ser uma string." },
        { status: 400 }
      );
    }

    // 3. Recupera o item do Firestore via Admin SDK
    const db = getAdminFirestore();
    const docRef = db.collection("knowledgeItems").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: "O item de conhecimento clínico não foi encontrado." },
        { status: 404 }
      );
    }

    const data = docSnap.data();
    if (!data) {
      return NextResponse.json(
        { error: "Erro ao ler os dados do item de conhecimento." },
        { status: 500 }
      );
    }

    // Se o item já estiver deletado logicamente, impede publicação
    if (data.deletedAt) {
      return NextResponse.json(
        { error: "Não é possível publicar um item que foi excluído." },
        { status: 400 }
      );
    }

    // 4. Concatena os textos clínicos para a geração de embeddings
    const title = data.title || "";
    const summary = data.summary || "";
    const content = data.content || "";
    const tags = Array.isArray(data.tags) ? data.tags.join(", ") : "";
    const textToEmbed = `${title}\n${summary}\n${content}\nTags: ${tags}`;

    // 5. Gera o vetor de embeddings (768 dimensões)
    let embedding: number[];
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
      // Mock de vetor para desenvolvimento/testes locais sem chave de API do Gemini
      embedding = new Array(768).fill(0).map(() => Math.random() * 0.1);
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
          contents: textToEmbed,
        });

        if (!response.embeddings?.[0]?.values) {
          return NextResponse.json(
            { error: "A API do Gemini retornou uma resposta de embedding inválida." },
            { status: 502 }
          );
        }

        embedding = response.embeddings[0].values;
      } catch (err) {
        console.error("Erro na chamada à API do Gemini:", err);
        return NextResponse.json(
          { error: "Falha na comunicação com o serviço de embeddings do Gemini." },
          { status: 502 }
        );
      }
    }

    // 6. Atualiza o documento no Firestore com status de publicado e o vetor
    await docRef.update({
      reviewStatus: "published",
      reviewedBy: sessionUser.uid,
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      embedding: FieldValue.vector(embedding),
      // Marca o embedding como atualizado em relação ao conteúdo publicado.
      // Se o conteúdo for editado após a publicação, updateKnowledgeItemContent
      // grava embeddingVersion: 0 para sinalizar que o vetor está desatualizado.
      embeddingVersion: 1,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no Route Handler de publicação:", error);
    const mappedError = mapFirebaseError(error);
    return NextResponse.json(
      { error: mappedError.message || "Erro interno no servidor ao processar publicação." },
      { status: 500 }
    );
  }
}
