import "server-only";

import { getProfileAsAdmin } from "@/domains/users/admin-repository";
import type { Profile, ProfileRole } from "@/lib/validation/profile.schema";
import { getSessionUser, type SessionUser } from "@/lib/security/session";

export interface AuthorizedSession {
  sessionUser: SessionUser;
  profile: Profile;
}

/**
 * Verifica, no servidor, se há uma sessão válida E se o perfil correspondente
 * possui um dos papéis autorizados. Usado para proteger o painel
 * administrativo (Server Components) além da checagem básica de autenticação
 * já feita em `(dashboard)/layout.tsx`.
 *
 * Retorna `null` quando não autenticado, sem perfil, com conta inativa ou
 * sem papel autorizado — nunca lança, para o chamador decidir o
 * redirecionamento (evita vazar detalhes do motivo da negação).
 */
export async function getAuthorizedSession(
  allowedRoles: ProfileRole[],
): Promise<AuthorizedSession | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const profile = await getProfileAsAdmin(sessionUser.uid);
  if (!profile) return null;
  if (profile.status !== "active") return null;
  if (!allowedRoles.includes(profile.role)) return null;

  return { sessionUser, profile };
}

/**
 * Verifica, no servidor, se há uma sessão válida com conta ativa — sem
 * restringir a um papel específico. Use para proteger rotas que qualquer
 * usuário autenticado e ativo pode acessar (ex.: chat RAG, busca semântica).
 *
 * Retorna `null` se não autenticado, sem perfil ou com conta inativa/bloqueada.
 * Nunca lança — o chamador decide a resposta de erro.
 */
export async function getActiveSession(): Promise<AuthorizedSession | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  const profile = await getProfileAsAdmin(sessionUser.uid);
  if (!profile) return null;
  if (profile.status !== "active") return null;

  return { sessionUser, profile };
}

export const CONTENT_EDITOR_ROLES: ProfileRole[] = ["professional", "reviewer", "administrator"];
export const REVIEWER_ROLES: ProfileRole[] = ["reviewer", "administrator"];
export const ADMIN_ROLES: ProfileRole[] = ["administrator"];

