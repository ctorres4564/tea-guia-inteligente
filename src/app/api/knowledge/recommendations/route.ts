import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";

export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getActiveSession } from "@/lib/security/authorization";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { knowledgeItemSchema, type KnowledgeItem } from "@/lib/validation/knowledge.schema";
import { calculateAge, formatAgeLabel } from "@/lib/utils/age";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit } from "@/lib/security/rate-limit";

const SIMILARITY_THRESHOLD = 0.55;
const RATE_LIMIT_CONFIG = { maxRequests: 40, windowMs: 60_000 };

interface RecommendedItem extends Omit<KnowledgeItem, "embedding"> {
  similarity: number;
  recommendationReason: string;
}

export async function GET(_request: NextRequest) {
  let userId = "unknown";
  try {
    // 1. Valida autenticação
    const activeSession = await getActiveSession();
    if (!activeSession) {
      return NextResponse.json(
        { error: "Acesso negado. Requer autenticação e conta ativa." },
        { status: 401 }
      );
    }

    // 1b. Rate limit centralizado (40 requisições/min)
    const { sessionUser } = activeSession;
    userId = sessionUser.uid;
    const rateLimitRes = checkRateLimit(`recommendations:${userId}`, RATE_LIMIT_CONFIG);
    if (!rateLimitRes.success) {
      logger.warn("Recommendations rate limit exceeded", { userId: sessionUser.uid });
      return NextResponse.json(
        { error: "Limite de requisições excedido. Aguarde 1 minuto." },
        { status: 429 }
      );
    }

    const db = getAdminFirestore();

    // 2. Busca perfis de crianças cadastradas
    const childrenSnapshot = await db
      .collection("children")
      .doc(userId)
      .collection("profiles")
      .get();

    // Caso não haja crianças cadastradas: fallback com novidades gerais (os 3 mais recentes)
    if (childrenSnapshot.empty) {
      const recentSnapshot = await db
        .collection("knowledgeItems")
        .where("reviewStatus", "==", "published")
        .where("deletedAt", "==", null)
        .orderBy("publishedAt", "desc")
        .limit(3)
        .get();

      const results: RecommendedItem[] = recentSnapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const dataToValidate = { ...data };
          delete dataToValidate.embedding;

          const parsed = knowledgeItemSchema.safeParse({ id: docSnap.id, ...dataToValidate });
          if (!parsed.success) return null;
          const clean = { ...parsed.data };
          delete (clean as any).embedding;
          return {
            ...clean,
            similarity: 1.0,
            recommendationReason: "Conteúdo clínico publicado recentemente na plataforma.",
          };
        })
        .filter((item): item is RecommendedItem => item !== null);

      return NextResponse.json({ results, hasProfile: false });
    }

    // Processa recomendações baseadas no perfil da(s) criança(s)
    const apiKey = process.env.GEMINI_API_KEY;
    const isEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
    const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

    const allRecommendations: RecommendedItem[] = [];
    const seenIds = new Set<string>();

    for (const childDoc of childrenSnapshot.docs) {
      const childData = childDoc.data();
      const name = childData.name || "Criança";
      const birthDate = childData.birthDate;
      const interests = (childData.interests || []) as string[];
      const sensitivities = (childData.sensitivities || []) as string[];
      const supportLevel = childData.supportLevel || "";

      const ageBreakdown = birthDate ? calculateAge(birthDate) : { years: 0, months: 0, totalMonths: 0 };
      const ageLabel = birthDate ? formatAgeLabel(birthDate) : "";

      // 3. Monta termo de busca para embeddings de afinidade
      const queryTerms: string[] = [];
      if (interests.length > 0) {
        queryTerms.push(`interesses e atividades: ${interests.join(", ")}`);
      }
      if (sensitivities.length > 0) {
        queryTerms.push(`sensibilidades e aversões: ${sensitivities.join(", ")}`);
      }
      if (supportLevel) {
        const supportFriendly = supportLevel === "level_1" ? "suporte leve" : supportLevel === "level_2" ? "suporte moderado" : "suporte severo/substancial";
        queryTerms.push(`nível de suporte: ${supportFriendly}`);
      }

      const q = queryTerms.length > 0
        ? `autismo desenvolvimento infantil, ${queryTerms.join(", ")}`
        : "autismo desenvolvimento infantil marcos de desenvolvimento estímulo";

      // 4. Gera embedding
      let queryEmbedding: number[];
      if (!ai || (isEmulator && !apiKey)) {
        // Mock local
        queryEmbedding = new Array(768).fill(0).map(() => Math.random() * 0.1);
      } else {
        try {
          const embedRes = await ai.models.embedContent({
            model: "gemini-embedding-2",
            contents: q,
            config: {
              outputDimensionality: 768,
            },
          });
          if (!embedRes.embeddings?.[0]?.values) {
            throw new Error("Formato de resposta de embedding inválido.");
          }
          queryEmbedding = embedRes.embeddings[0].values;
        } catch (err) {
          console.error("Erro ao gerar embedding de afinidade para recomendações:", err);
          // Fallback silencioso por tags na query KNN
          queryEmbedding = new Array(768).fill(0).map(() => Math.random() * 0.1);
        }
      }

      // 5. Query KNN no Firestore
      const vectorQuery = db
        .collection("knowledgeItems")
        .where("reviewStatus", "==", "published")
        .where("deletedAt", "==", null)
        .findNearest({
          vectorField: "embedding",
          queryVector: FieldValue.vector(queryEmbedding),
          limit: 15,
          distanceMeasure: "COSINE",
          distanceResultField: "searchDistance",
        });

      const snapshot = await vectorQuery.get();

      const childRecs = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const distance = data.searchDistance ?? 1.0;
          const similarity = 1 - distance;

          const dataToValidate = { ...data };
          delete dataToValidate.embedding;

          const parsed = knowledgeItemSchema.safeParse({ id: docSnap.id, ...dataToValidate });
          if (!parsed.success) return null;

          const item = parsed.data;
          // Pós-filtro em memória por público-alvo (recomendações no dashboard para a família são para público family/general)
          if (!item.targetAudience.includes("family") && !item.targetAudience.includes("general")) {
            return null;
          }

          // Filtro por faixa etária se o artigo a tiver
          if (item.ageRange) {
            const ageRangeLower = item.ageRange.toLowerCase();
            const childYears = ageBreakdown.years;

            // Lógica simples de match de idade (ex: "2-4", "bebês", "escolar", "adolescentes")
            let ageMatch = false;
            if (childYears <= 2 && (ageRangeLower.includes("bebê") || ageRangeLower.includes("0-2") || ageRangeLower.includes("primeira infância"))) {
              ageMatch = true;
            } else if (childYears > 2 && childYears <= 5 && (ageRangeLower.includes("pré-escolar") || ageRangeLower.includes("2-5") || ageRangeLower.includes("3-5"))) {
              ageMatch = true;
            } else if (childYears > 5 && childYears <= 11 && (ageRangeLower.includes("escolar") || ageRangeLower.includes("6-11") || ageRangeLower.includes("infantil"))) {
              ageMatch = true;
            } else if (childYears > 11 && (ageRangeLower.includes("adolesce") || ageRangeLower.includes("12+") || ageRangeLower.includes("jovem"))) {
              ageMatch = true;
            } else if (ageRangeLower.includes("qualquer") || ageRangeLower.includes("todas") || ageRangeLower.includes("geral")) {
              ageMatch = true;
            }

            if (!ageMatch) return null;
          }

          const cleanItem = { ...item };
          delete (cleanItem as any).embedding;

          // Monta a justificativa da recomendação
          let reason = `Recomendado para ${name}`;
          if (ageLabel) {
            reason += ` (${ageLabel})`;
          }
          const matchedInterest = interests.find(interest =>
            item.title.toLowerCase().includes(interest.toLowerCase()) ||
            item.summary.toLowerCase().includes(interest.toLowerCase()) ||
            item.tags.some(t => t.toLowerCase() === interest.toLowerCase())
          );
          if (matchedInterest) {
            reason += ` devido ao interesse em "${matchedInterest}".`;
          } else {
            reason += ` com base em afinidade clínica com o perfil.`;
          }

          return {
            ...cleanItem,
            similarity,
            recommendationReason: reason,
          };
        })
        .filter((item): item is RecommendedItem => item !== null && item.similarity >= SIMILARITY_THRESHOLD);

      for (const rec of childRecs) {
        if (!seenIds.has(rec.id)) {
          seenIds.add(rec.id);
          allRecommendations.push(rec);
        }
      }
    }

    // Ordena as recomendações combinadas de forma decrescente pela similaridade
    allRecommendations.sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({
      results: allRecommendations.slice(0, 4), // Retorna até 4 recomendações finais
      hasProfile: true
    });
  } catch (error) {
    logger.error("Erro ao obter recomendações personalizadas", { userId }, error);
    const mappedError = mapFirebaseError(error);
    return NextResponse.json(
      { error: mappedError.message || "Erro interno ao processar recomendações." },
      { status: 500 }
    );
  }
}
