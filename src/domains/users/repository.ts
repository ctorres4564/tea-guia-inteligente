"use client";

import { doc, getDoc } from "firebase/firestore";

import { getFirebaseFirestore } from "@/lib/firebase/client";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { profileSchema, type Profile } from "@/lib/validation/profile.schema";
import { FIRESTORE_COLLECTIONS } from "@/types/firestore";

/**
 * Busca o perfil do usuário autenticado em `profiles/{uid}`.
 * Retorna `null` quando o documento ainda não existe (ex.: logo após o cadastro,
 * antes da propagação) em vez de lançar erro.
 */
export async function getProfile(uid: string): Promise<Profile | null> {
  try {
    const firestore = getFirebaseFirestore();
    const snapshot = await getDoc(doc(firestore, FIRESTORE_COLLECTIONS.profiles, uid));

    if (!snapshot.exists()) return null;

    const parsed = profileSchema.safeParse({ uid, ...snapshot.data() });
    if (!parsed.success) {
      // Documento corrompido ou fora do schema esperado — tratado como ausente
      // em vez de quebrar a interface do usuário.
      return null;
    }

    return parsed.data;
  } catch (error) {
    throw mapFirebaseError(error);
  }
}
