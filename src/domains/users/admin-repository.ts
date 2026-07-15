import "server-only";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { profileSchema, type Profile } from "@/lib/validation/profile.schema";
import { FIRESTORE_COLLECTIONS } from "@/types/firestore";

/**
 * Variante server-side (Admin SDK) de leitura de perfil, usada em
 * Server Components/Route Handlers onde já se confia no `uid` verificado
 * via cookie de sessão (ver `lib/security/session.ts`).
 */
export async function getProfileAsAdmin(uid: string): Promise<Profile | null> {
  const snapshot = await getAdminFirestore().collection(FIRESTORE_COLLECTIONS.profiles).doc(uid).get();

  if (!snapshot.exists) return null;

  const parsed = profileSchema.safeParse({ uid, ...snapshot.data() });
  if (!parsed.success) return null;

  return parsed.data;
}
