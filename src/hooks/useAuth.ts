"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

import { onAuthStateChanged } from "@/domains/auth/service";
import { getProfile } from "@/domains/users/repository";
import type { Profile } from "@/lib/validation/profile.schema";

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
}

/**
 * Estado de autenticação do lado do cliente: usuário do Firebase Auth + perfil
 * correspondente no Firestore. Usado para renderizar UI (nome, papel, status).
 *
 * Não deve ser usado como única forma de proteção de rotas — ver
 * docs/decisions/ADR-002-auth-strategy.md para a estratégia completa
 * (cookie de sessão verificado no servidor + middleware).
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (user) => {
      if (!user) {
        setState({ user: null, profile: null, isLoading: false });
        return;
      }

      try {
        const profile = await getProfile(user.uid);
        setState({ user, profile, isLoading: false });
      } catch {
        setState({ user, profile: null, isLoading: false });
      }
    });

    return unsubscribe;
  }, []);

  return state;
}
