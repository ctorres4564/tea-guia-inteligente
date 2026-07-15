import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { CONTENT_EDITOR_ROLES, getAuthorizedSession } from "@/lib/security/authorization";

/**
 * Guarda de acesso do painel administrativo (Fase 2).
 * Além da checagem de autenticação já feita em `(dashboard)/layout.tsx`,
 * aqui verificamos o PAPEL do usuário no servidor antes de renderizar
 * qualquer coisa — usuários com papel `family`/`educator` são redirecionados
 * de volta ao dashboard comum, sem acesso a nenhuma rota `/dashboard/admin/*`.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authorized = await getAuthorizedSession(CONTENT_EDITOR_ROLES);

  if (!authorized) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-4 text-sm font-medium">
        <Link href="/dashboard/admin" className="rounded-card px-3 py-1.5 text-slate-600 hover:bg-slate-100">
          Visão geral
        </Link>
        <Link
          href="/dashboard/admin/categorias"
          className="rounded-card px-3 py-1.5 text-slate-600 hover:bg-slate-100"
        >
          Categorias
        </Link>
        <Link
          href="/dashboard/admin/conteudos"
          className="rounded-card px-3 py-1.5 text-slate-600 hover:bg-slate-100"
        >
          Conteúdos
        </Link>
      </nav>
      {children}
    </div>
  );
}
