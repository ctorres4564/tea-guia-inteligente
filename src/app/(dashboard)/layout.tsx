import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { LogoutButton } from "@/components/feedback/LogoutButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { siteConfig } from "@/config/site";
import { getSessionUser } from "@/lib/security/session";

/**
 * Proteção de rota no SERVIDOR (camada de segurança real — ver ADR-002).
 * O middleware já bloqueia a navegação sem cookie de sessão; aqui, além
 * disso, o cookie é verificado criptograficamente via Firebase Admin SDK
 * antes de renderizar qualquer conteúdo do dashboard.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect(siteConfig.routes.login);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 transition-colors dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-semibold text-brand-700 dark:text-brand-400">{siteConfig.name}</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6">
        <aside className="w-56 shrink-0">
          <AppSidebar />
        </aside>
        <main className="flex-1 text-slate-900 dark:text-slate-100">{children}</main>
      </div>
    </div>
  );
}
