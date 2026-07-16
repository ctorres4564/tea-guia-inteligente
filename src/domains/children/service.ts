"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  addDoc,
  updateDoc,
} from "firebase/firestore";

import { getFirebaseFirestore } from "@/lib/firebase/client";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import {
  childProfileSchema,
  type ChildProfile,
  type ChildProfileFormInput,
} from "@/lib/validation/child-profile.schema";
import { FIRESTORE_COLLECTIONS } from "@/types/firestore";

// Estrutura: children/{userId}/profiles/{childId} — mesmo padrão de
// isolamento por usuário já usado em favorites/{userId}/items e
// history/{userId}/items.
const getChildrenCollection = (userId: string) => {
  const db = getFirebaseFirestore();
  return collection(db, FIRESTORE_COLLECTIONS.children, userId, "profiles");
};

export async function listChildren(userId: string): Promise<ChildProfile[]> {
  try {
    const q = query(getChildrenCollection(userId), orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map((docSnap) => {
        const parsed = childProfileSchema.safeParse({ id: docSnap.id, ...docSnap.data() });
        return parsed.success ? parsed.data : null;
      })
      .filter((child): child is ChildProfile => child !== null);
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function getChild(userId: string, childId: string): Promise<ChildProfile | null> {
  try {
    const db = getFirebaseFirestore();
    const snapshot = await getDoc(
      doc(db, FIRESTORE_COLLECTIONS.children, userId, "profiles", childId),
    );
    if (!snapshot.exists()) return null;

    const parsed = childProfileSchema.safeParse({ id: snapshot.id, ...snapshot.data() });
    return parsed.success ? parsed.data : null;
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function createChild(
  userId: string,
  input: ChildProfileFormInput,
): Promise<string> {
  try {
    const docRef = await addDoc(getChildrenCollection(userId), {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function updateChild(
  userId: string,
  childId: string,
  patch: Partial<ChildProfileFormInput>,
): Promise<void> {
  try {
    const db = getFirebaseFirestore();
    await updateDoc(doc(db, FIRESTORE_COLLECTIONS.children, userId, "profiles", childId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function deleteChild(userId: string, childId: string): Promise<void> {
  try {
    const db = getFirebaseFirestore();
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.children, userId, "profiles", childId));
  } catch (error) {
    throw mapFirebaseError(error);
  }
}
