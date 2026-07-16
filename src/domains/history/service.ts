import {
  collection,
  getDocs,
  query,
  addDoc,
  orderBy,
  serverTimestamp,
  limit,
  Timestamp,
} from "firebase/firestore";

import { getFirebaseFirestore } from "@/lib/firebase/client";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { getKnowledgeItem } from "@/domains/knowledge/service";
import type { HistoryType } from "@/lib/validation/history.schema";
import type { KnowledgeItem } from "@/lib/validation/knowledge.schema";
import { FIRESTORE_COLLECTIONS } from "@/types/firestore";

const getHistoryCollection = (userId: string) => {
  const db = getFirebaseFirestore();
  return collection(db, FIRESTORE_COLLECTIONS.history, userId, "items");
};

/**
 * Adiciona uma entrada no histórico do usuário.
 */
export async function addHistoryEntry(
  userId: string,
  entry: {
    type: HistoryType;
    query?: string;
    knowledgeItemId?: string | null;
  }
): Promise<string> {
  try {
    const colRef = getHistoryCollection(userId);
    const docRef = await addDoc(colRef, {
      type: entry.type,
      query: entry.query ?? "",
      knowledgeItemId: entry.knowledgeItemId ?? null,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export interface HistoryWithItem {
  id: string;
  type: HistoryType;
  query?: string;
  knowledgeItemId?: string | null;
  createdAt: Timestamp | null;
  item?: KnowledgeItem | null;
}

/**
 * Lista as últimas 30 entradas do histórico de interações do usuário.
 * Carrega a ficha clínica associada para as visualizações do tipo "view".
 */
export async function listHistory(userId: string): Promise<HistoryWithItem[]> {
  try {
    const colRef = getHistoryCollection(userId);
    // Limita aos últimos 30 registros
    const q = query(colRef, orderBy("createdAt", "desc"), limit(30));
    const snapshot = await getDocs(q);

    const historyItems = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        type: data.type as HistoryType,
        query: data.query as string | undefined,
        knowledgeItemId: data.knowledgeItemId as string | null | undefined,
        createdAt: data.createdAt,
      };
    });

    // Resolve as fichas clínicas se o tipo de histórico for visualização ("view")
    const resolved = await Promise.all(
      historyItems.map(async (hist) => {
        if (hist.type === "view" && hist.knowledgeItemId) {
          try {
            const item = await getKnowledgeItem(hist.knowledgeItemId);
            return {
              ...hist,
              item,
            };
          } catch {
            return {
              ...hist,
              item: null,
            };
          }
        }
        return hist;
      })
    );

    return resolved;
  } catch (error) {
    throw mapFirebaseError(error);
  }
}
