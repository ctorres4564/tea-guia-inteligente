"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { getFirebaseFirestore } from "@/lib/firebase/client";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { categorySchema, type Category, type CategoryStatus } from "@/lib/validation/category.schema";
import { FIRESTORE_COLLECTIONS } from "@/types/firestore";

const COLLECTION = FIRESTORE_COLLECTIONS.categories;

export interface CategoryFormInput {
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  displayOrder?: number;
}

/**
 * Lista todas as categorias (as regras do Firestore garantem que apenas
 * editores de conteúdo enxerguem rascunhos/arquivadas; o público geral só
 * recebe as publicadas). Ordenadas por `displayOrder`.
 */
export async function listCategories(): Promise<Category[]> {
  try {
    const firestore = getFirebaseFirestore();
    const snapshot = await getDocs(
      query(collection(firestore, COLLECTION), orderBy("displayOrder", "asc")),
    );

    return snapshot.docs
      .map((docSnap) => {
        const parsed = categorySchema.safeParse({ id: docSnap.id, ...docSnap.data() });
        return parsed.success ? parsed.data : null;
      })
      .filter((category): category is Category => category !== null);
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function createCategory(input: CategoryFormInput): Promise<string> {
  try {
    const firestore = getFirebaseFirestore();
    const docRef = await addDoc(collection(firestore, COLLECTION), {
      name: input.name,
      slug: input.slug,
      description: input.description ?? "",
      parentId: input.parentId ?? null,
      status: "draft" satisfies CategoryStatus,
      displayOrder: input.displayOrder ?? 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function updateCategory(
  id: string,
  patch: Partial<CategoryFormInput>,
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await updateDoc(doc(firestore, COLLECTION, id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function setCategoryStatus(id: string, status: CategoryStatus): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await updateDoc(doc(firestore, COLLECTION, id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

/**
 * Exclusão física — as regras do Firestore restringem esta operação a
 * administradores. Para o uso comum, prefira `setCategoryStatus(id, "archived")`.
 */
export async function deleteCategoryPermanently(id: string): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await deleteDoc(doc(firestore, COLLECTION, id));
  } catch (error) {
    throw mapFirebaseError(error);
  }
}
