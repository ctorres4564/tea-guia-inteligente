import "server-only";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "@/types/firestore";

export interface DashboardStats {
  totalCategories: number;
  publishedCategories: number;
  totalKnowledgeItems: number;
  publishedKnowledgeItems: number;
  inReviewKnowledgeItems: number;
  draftKnowledgeItems: number;
}

/**
 * Estatísticas simples para a visão geral do painel administrativo.
 * Usa consultas de agregação (`count()`) do Firestore — não trafegam os
 * documentos inteiros, apenas a contagem.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const firestore = getAdminFirestore();
  const categories = firestore.collection(FIRESTORE_COLLECTIONS.categories);
  const knowledgeItems = firestore.collection(FIRESTORE_COLLECTIONS.knowledgeItems);

  const [
    totalCategories,
    publishedCategories,
    totalKnowledgeItems,
    publishedKnowledgeItems,
    inReviewKnowledgeItems,
    draftKnowledgeItems,
  ] = await Promise.all([
    categories.count().get(),
    categories.where("status", "==", "published").count().get(),
    knowledgeItems.count().get(),
    knowledgeItems.where("reviewStatus", "==", "published").count().get(),
    knowledgeItems.where("reviewStatus", "==", "in_review").count().get(),
    knowledgeItems.where("reviewStatus", "==", "draft").count().get(),
  ]);

  return {
    totalCategories: totalCategories.data().count,
    publishedCategories: publishedCategories.data().count,
    totalKnowledgeItems: totalKnowledgeItems.data().count,
    publishedKnowledgeItems: publishedKnowledgeItems.data().count,
    inReviewKnowledgeItems: inReviewKnowledgeItems.data().count,
    draftKnowledgeItems: draftKnowledgeItems.data().count,
  };
}
