import "server-only";

import { cookies } from "next/headers";

import { getAdminAuth } from "@/lib/firebase/admin";
import type { ProfileRole } from "@/lib/validation/profile.schema";
import { SESSION_COOKIE_NAME } from "@/lib/security/session-cookie";

export { SESSION_COOKIE_NAME } from "@/lib/security/session-cookie";

/**
 * Dados mínimos derivados de um cookie de sessão válido.
 */
export interface SessionUser {
  uid: string;
  email: string | null;
  role?: ProfileRole;
}

/**
 * Verifica o cookie de sessão (session cookie do Firebase Admin) no servidor.
 * Retorna `null` quando não há sessão válida — nunca lança para o chamador tratar
 * como "não autenticado" de forma simples.
 *
 * Limitação documentada (ver docs/decisions/ADR-002-auth-strategy.md):
 * este helper não verifica papéis/custom claims por si só além do que estiver
 * embutido no token; validações de autorização mais finas devem consultar o
 * Firestore (`profiles/{uid}`) quando necessário.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      role: (decoded as Record<string, unknown>).role as ProfileRole | undefined,
    };
  } catch {
    // Cookie ausente, expirado, revogado ou inválido — tratado como não autenticado.
    return null;
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }
  return user;
}
