import {
  collection,
  getDocs,
  query,
  addDoc,
  deleteDoc,
  doc,
  orderBy,
  serverTimestamp,
  limit,
  startAfter,
  Timestamp,
} from "firebase/firestore";

import { getFirebaseFirestore } from "@/lib/firebase/client";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { getKnowledgeItem } from "@/domains/knowledge/service";
import type { HistoryType } from "@/lib/validation/history.schema";
import type { KnowledgeItem } from "@/lib/validation/knowledge.schema";
import { FIRESTORE_COLLECTIONS } from "@/types/firestore";

const HISTORY_MAX_ENTRIES = 30;

const getHistoryCollection = (userId: string) => {
  const db = getFirebaseFirestore();
  return collection(db, FIRESTORE_COLLECTIONS.history, userId, "items");
};

/**
 * Adiciona uma entrada no histórico do usuário e aplica política de retenção.
 *
 * Após inserção, verifica se existem entradas além do limite de 30 e as remove.
 * Isso garante que dados sensíveis de interações não se acumulem indefinidamente,
 * importante antes da introdução de dados de crianças na Fase 7.
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

    // Política de retenção: remove entradas além das 30 mais recentes.
    // Busca a 30ª entrada e usa-a como cursor para deletar o excesso.
    try {
      const limitQuery = query(
        colRef,
        orderBy("createdAt", "desc"),
        limit(HISTORY_MAX_ENTRIES)
      );
      const limitSnap = await getDocs(limitQuery);

      if (limitSnap.docs.length === HISTORY_MAX_ENTRIES) {
        const lastDoc = limitSnap.docs[HISTORY_MAX_ENTRIES - 1];
        const overflowQuery = query(
          colRef,
          orderBy("createdAt", "desc"),
          startAfter(lastDoc)
        );
        const overflowSnap = await getDocs(overflowQuery);
        const db = getFirebaseFirestore();
        await Promise.all(
          overflowSnap.docs.map((d) =>
            deleteDoc(doc(db, FIRESTORE_COLLECTIONS.history, userId, "items", d.id))
          )
        );
      }
    } catch (cleanupErr) {
      // Erro de limpeza não deve bloquear o registro da entrada
      console.warn("Falha ao aplicar política de retenção do histórico:", cleanupErr);
    }

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
