import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/security/session-cookie";

/**
 * Proteção de rotas em camada de middleware (Edge).
 *
 * IMPORTANTE — limitação documentada (ver docs/decisions/ADR-002-auth-strategy.md):
 * o middleware roda no Edge Runtime e NÃO pode usar o Firebase Admin SDK
 * (depende de APIs Node.js). Por isso, aqui verificamos apenas a PRESENÇA do
 * cookie de sessão, para bloquear acesso não autenticado de forma rápida e
 * evitar flash de conteúdo protegido.
 *
 * A verificação CRIPTOGRÁFICA completa do cookie (assinatura, expiração,
 * revogação) acontece no servidor, em Server Components / Route Handlers,
 * via `getSessionUser()` (`src/lib/security/session.ts`), que usa o Firebase
 * Admin SDK no runtime Node.js.
 *
 * Ou seja: o middleware é a primeira barreira (UX), e a verificação no
 * servidor é a barreira de segurança real.
 */
const PROTECTED_PREFIXES = ["/dashboard"];
const AUTH_ONLY_PREFIXES = ["/login", "/cadastro", "/recuperar-senha"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthOnly = AUTH_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthOnly && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/cadastro", "/recuperar-senha"],
};
