"use client";

import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  addDoc,
  updateDoc,
} from "firebase/firestore";

import { getFirebaseFirestore } from "@/lib/firebase/client";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import {
  knowledgeItemSchema,
  type EvidenceLevel,
  type KnowledgeAttachment,
  type KnowledgeItem,
  type TargetAudience,
} from "@/lib/validation/knowledge.schema";
import { FIRESTORE_COLLECTIONS } from "@/types/firestore";

const COLLECTION = FIRESTORE_COLLECTIONS.knowledgeItems;

export interface KnowledgeItemFormInput {
  categoryId: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  targetAudience: TargetAudience[];
  ageRange?: string;
  tags: string[];
  evidenceLevel: EvidenceLevel;
}

/**
 * Busca uma única ficha pelo ID. Retorna `null` quando não existe ou quando
 * o documento não corresponde ao schema esperado.
 */
export async function getKnowledgeItem(id: string): Promise<KnowledgeItem | null> {
  try {
    const firestore = getFirebaseFirestore();
    const snapshot = await getDoc(doc(firestore, COLLECTION, id));
    if (!snapshot.exists()) return null;

    const parsed = knowledgeItemSchema.safeParse({ id: snapshot.id, ...snapshot.data() });
    return parsed.success ? parsed.data : null;
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

/**
 * Lista os conteúdos visíveis para o usuário atual. Para editores de
 * conteúdo (papel professional/reviewer/administrator), as regras do
 * Firestore liberam a leitura de todos os status; a filtragem de itens
 * excluídos (deletedAt != null) é feita aqui, no cliente, para manter a
 * consulta simples (sem exigir índice adicional para esse filtro).
 */
export async function listKnowledgeItems(options?: { includeDeleted?: boolean }): Promise<
  KnowledgeItem[]
> {
  try {
    const firestore = getFirebaseFirestore();
    const snapshot = await getDocs(
      query(collection(firestore, COLLECTION), orderBy("updatedAt", "desc")),
    );

    return snapshot.docs
      .map((docSnap) => {
        const parsed = knowledgeItemSchema.safeParse({ id: docSnap.id, ...docSnap.data() });
        return parsed.success ? parsed.data : null;
      })
      .filter((item): item is KnowledgeItem => item !== null)
      .filter((item) => options?.includeDeleted || !item.deletedAt);
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function createKnowledgeItem(
  input: KnowledgeItemFormInput,
  authorUid: string,
): Promise<string> {
  try {
    const firestore = getFirebaseFirestore();
    const docRef = await addDoc(collection(firestore, COLLECTION), {
      categoryId: input.categoryId,
      title: input.title,
      slug: input.slug,
      summary: input.summary,
      content: input.content,
      targetAudience: input.targetAudience,
      ageRange: input.ageRange ?? "",
      tags: input.tags,
      evidenceLevel: input.evidenceLevel,
      reviewStatus: "draft",
      version: 1,
      publishedAt: null,
      createdBy: authorUid,
      reviewedBy: null,
      deletedAt: null,
      attachments: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

/**
 * Atualiza os campos de CONTEÚDO de uma ficha (título, resumo, texto,
 * público-alvo, tags etc.) e incrementa `version` automaticamente — toda
 * edição de conteúdo gera uma nova versão, conforme a modelagem definida
 * em `docs/architecture/firestore-model.md`.
 *
 * Não altera `reviewStatus` — use `submitForReview`/`approveKnowledgeItem`/
 * `publishKnowledgeItem`/`rejectKnowledgeItem` para transições de revisão.
 */
export async function updateKnowledgeItemContent(
  id: string,
  patch: Partial<KnowledgeItemFormInput>,
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await updateDoc(doc(firestore, COLLECTION, id), {
      ...patch,
      version: increment(1),
      updatedAt: serverTimestamp(),
      // Invalida o embedding: qualquer edição de conteúdo desatualiza o vetor
      // semântico existente. A próxima publicação via Admin SDK (publish route)
      // regenera o embedding e grava embeddingVersion: 1.
      embeddingVersion: 0,
    });
  } catch (error) {
    throw mapFirebaseError(error);
  }
}


export async function submitKnowledgeItemForReview(id: string): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await updateDoc(doc(firestore, COLLECTION, id), {
      reviewStatus: "in_review",
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

/**
 * Transições restritas a revisor/administrador (garantidas pelas regras do
 * Firestore — ver `firebase/firestore.rules`).
 */
export async function approveKnowledgeItem(id: string, reviewerUid: string): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await updateDoc(doc(firestore, COLLECTION, id), {
      reviewStatus: "approved",
      reviewedBy: reviewerUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function publishKnowledgeItem(id: string, _reviewerUid: string): Promise<void> {
  try {
    const res = await fetch("/api/admin/knowledge/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erro ao publicar o item (HTTP ${res.status}).`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Erro desconhecido ao tentar publicar o conteúdo.");
  }
}

export async function rejectKnowledgeItem(
  id: string,
  reviewerUid: string,
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await updateDoc(doc(firestore, COLLECTION, id), {
      reviewStatus: "rejected",
      reviewedBy: reviewerUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

/**
 * Exclusão lógica — restrita a administradores pelas regras do Firestore.
 */
export async function softDeleteKnowledgeItem(id: string): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await updateDoc(doc(firestore, COLLECTION, id), {
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function restoreKnowledgeItem(id: string): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await updateDoc(doc(firestore, COLLECTION, id), {
      deletedAt: null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

/**
 * Exclusão física — restrita a administradores pelas regras do Firestore.
 * Prefira `softDeleteKnowledgeItem` para o uso comum (mantém histórico e
 * possibilidade de auditoria/recuperação).
 */
export async function deleteKnowledgeItemPermanently(id: string): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await deleteDoc(doc(firestore, COLLECTION, id));
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

/**
 * Associa um anexo (já enviado ao Storage — ver
 * `src/domains/knowledge/storage-service.ts`) à ficha. Não incrementa
 * `version`, pois anexos são materiais de apoio, não o conteúdo textual
 * principal.
 */
export async function addKnowledgeItemAttachment(
  id: string,
  attachment: KnowledgeAttachment,
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await updateDoc(doc(firestore, COLLECTION, id), {
      attachments: arrayUnion(attachment),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function removeKnowledgeItemAttachment(
  id: string,
  attachment: KnowledgeAttachment,
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await updateDoc(doc(firestore, COLLECTION, id), {
      attachments: arrayRemove(attachment),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

// `deleteField` reexportado apenas para eventual uso futuro por quem
// consumir este serviço (ex.: limpar `ageRange`), mantendo a API do
// Firestore acessível sem importar o SDK diretamente em componentes.
export { deleteField };
