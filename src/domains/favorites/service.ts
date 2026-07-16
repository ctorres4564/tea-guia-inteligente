import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  deleteDoc,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

import { getFirebaseFirestore } from "@/lib/firebase/client";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { getKnowledgeItem } from "@/domains/knowledge/service";
import type { KnowledgeItem } from "@/lib/validation/knowledge.schema";
import { FIRESTORE_COLLECTIONS } from "@/types/firestore";

// A coleção pai é "favorites", na qual cada usuário possui uma subcoleção "items"
const getFavoritesCollection = (userId: string) => {
  const db = getFirebaseFirestore();
  return collection(db, FIRESTORE_COLLECTIONS.favorites, userId, "items");
};

/**
 * Adiciona ou remove um artigo da lista de favoritos do usuário.
 * Usa o knowledgeItemId como ID determinístico do documento para garantir
 * operação idempotente e eliminar condições de corrida: dois cliques/
 * dispositivos simultâneos não criam documentos duplicados — o primeiro
 * cria, o segundo é uma escrita no-op (ou delete do mesmo doc).
 *
 * Retorna true se foi favoritado, false se foi desfavoritado.
 */
export async function toggleFavorite(userId: string, itemId: string): Promise<boolean> {
  try {
    const db = getFirebaseFirestore();
    // Documento com ID = knowledgeItemId: leitura única, sem query, sem corrida
    const favDocRef = doc(db, FIRESTORE_COLLECTIONS.favorites, userId, "items", itemId);
    const favSnap = await getDoc(favDocRef);

    if (favSnap.exists()) {
      // Já está favoritado → remove
      await deleteDoc(favDocRef);
      return false;
    } else {
      // Não está favoritado → cria com ID determinístico
      await setDoc(favDocRef, {
        knowledgeItemId: itemId,
        createdAt: serverTimestamp(),
      });
      return true;
    }
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

/**
 * Verifica se um artigo está nos favoritos do usuário.
 * Com ID determinístico, usa getDoc (uma leitura) em vez de query.
 */
export async function isFavorite(userId: string, itemId: string): Promise<boolean> {
  try {
    const db = getFirebaseFirestore();
    const favDocRef = doc(db, FIRESTORE_COLLECTIONS.favorites, userId, "items", itemId);
    const favSnap = await getDoc(favDocRef);
    return favSnap.exists();
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export interface FavoriteWithItem {
  id: string;
  knowledgeItemId: string;
  createdAt: Date | null;
  item: KnowledgeItem | null;
}

/**
 * Lista todos os favoritos do usuário com as fichas de conteúdo clínicas
 * correspondentes resolvidas.
 */
export async function listFavorites(userId: string): Promise<FavoriteWithItem[]> {
  try {
    const colRef = getFavoritesCollection(userId);
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const favorites = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        knowledgeItemId: data.knowledgeItemId as string,
        createdAt: data.createdAt,
      };
    });

    // Resolve as fichas clínicas de forma paralela e eficiente
    const resolved = await Promise.all(
      favorites.map(async (fav) => {
        try {
          const item = await getKnowledgeItem(fav.knowledgeItemId);
          return {
            ...fav,
            item,
          };
        } catch {
          return {
            ...fav,
            item: null,
          };
        }
      })
    );

    // Filtra favoritos cujo item correspondente não exista ou tenha sido removido
    return resolved.filter((fav) => fav.item !== null);
  } catch (error) {
    throw mapFirebaseError(error);
  }
}
