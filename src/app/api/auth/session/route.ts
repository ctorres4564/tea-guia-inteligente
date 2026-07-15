import "server-only";

import { NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/security/session-cookie";

// Validade do cookie de sessão: 5 dias (ver ADR-002).
const SESSION_EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000;

/**
 * Recebe o ID Token do Firebase Auth (obtido no cliente após login/cadastro)
 * e o troca por um cookie de sessão HTTP-only assinado pelo Firebase Admin.
 * Esse cookie é o que o middleware e os Server Components usam para verificar
 * a sessão no servidor, sem depender apenas do estado do cliente.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };

    if (!idToken) {
      return NextResponse.json({ error: "Token ausente." }, { status: 400 });
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: SESSION_EXPIRES_IN_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível criar a sessão. Faça login novamente." },
      { status: 401 },
    );
  }
}
