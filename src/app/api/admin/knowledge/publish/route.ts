import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { waitUntil } from "@vercel/functions";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAuthorizedSession, REVIEWER_ROLES } from "@/lib/security/authorization";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { logger } from "@/lib/observability/logger";

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

    // Impede bypass do fluxo editorial: apenas itens formalmente aprovados
    // (reviewStatus === "approved") podem ser publicados. Publicar um rascunho
    // ou item em revisão diretamente — mesmo via Admin SDK — é proibido para
    // garantir que nenhum conteúdo clínico não revisado seja exposto ao público.
    if (data.reviewStatus !== "approved") {
      return NextResponse.json(
        {
          error: `Publicação negada: o item está com status "${data.reviewStatus}". Apenas itens com status "approved" podem ser publicados.`,
        },
        { status: 409 }
      );
    }

    // 5. Atualiza o documento no Firestore com status de publicado instantaneamente (sem o vetor ainda)
    await docRef.update({
      reviewStatus: "published",
      reviewedBy: sessionUser.uid,
      publishedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      // Marca o embedding como desatualizado (0) para processamento em background
      embeddingVersion: 0,
    });

    // 6. Registra uma notificação de novos conteúdos no sistema
    await db.collection("notifications").add({
      type: "new_content",
      title: "Novo artigo clínico disponível!",
      summary: data.summary || "",
      contentId: id,
      contentSlug: data.slug || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    // 7. Dispara a geração do embedding em background (assíncrono).
    // A promise já começa a rodar imediatamente (fire-and-forget) — o que
    // segue é só a extensão do ciclo de vida da função serverless para lhe
    // dar chance de terminar após a resposta HTTP já ter sido enviada.
    const embeddingPromise = generateAndSaveEmbedding(id, data.title || "", data.summary || "", data.content || "", data.tags || []).catch((err) => {
      logger.error("Falha no processamento de embedding assíncrono", { itemId: id }, err);
    });

    try {
      // waitUntil real da Vercel (@vercel/functions): mantém a função
      // serverless viva até a promise resolver, mesmo após a resposta já
      // ter sido enviada ao cliente. Só tem efeito quando executado dentro
      // do runtime de uma Vercel Function; fora desse contexto (dev local,
      // testes, outros provedores) lança e caímos no catch abaixo — a
      // promise já disparada continua rodando de forma best-effort, sem
      // garantia de conclusão (mesma limitação que a rota de conciliação
      // manual `/api/admin/embeddings/reprocess` existe para cobrir).
      waitUntil(embeddingPromise);
    } catch {
      logger.warn(
        "waitUntil indisponível neste ambiente de execução (fora de uma Vercel Function); embedding segue em background sem garantia de conclusão pós-resposta.",
        { itemId: id }
      );
    }

    logger.info("Artigo clínico publicado com sucesso. Processando embedding em background.", { itemId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Erro no Route Handler de publicação", { userId: "unknown" }, error);
    const mappedError = mapFirebaseError(error);
    return NextResponse.json(
      { error: mappedError.message || "Erro interno no servidor ao processar publicação." },
      { status: 500 }
    );
  }
}

/**
 * Função de segundo plano para processamento assíncrono de embeddings.
 */
async function generateAndSaveEmbedding(
  id: string,
  title: string,
  summary: string,
  content: string,
  tags: string[]
): Promise<void> {
  const tagsStr = Array.isArray(tags) ? tags.join(", ") : "";
  const textToEmbed = `${title}\n${summary}\n${content}\nTags: ${tagsStr}`;

  let embedding: number[];
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
    embedding = new Array(768).fill(0).map(() => Math.random() * 0.1);
  } else {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não configurada no servidor.");
    }
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: textToEmbed,
      config: {
        outputDimensionality: 768,
      },
    });
    if (!response.embeddings?.[0]?.values) {
      throw new Error("A API retornou resposta de embedding inválida.");
    }
    embedding = response.embeddings[0].values;
  }

  const db = getAdminFirestore();
  await db.collection("knowledgeItems").doc(id).update({
    embedding: FieldValue.vector(embedding),
    embeddingVersion: 1,
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info("Embedding assíncrono gerado e gravado com sucesso", { itemId: id });
}
