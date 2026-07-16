import Link from "next/link";

import { siteConfig } from "@/config/site";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function AppHeader() {
  return (
    <header className="border-b border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href={siteConfig.routes.home} className="text-lg font-semibold text-brand-700 dark:text-brand-400">
          {siteConfig.name}
        </Link>
        <nav className="flex items-center gap-3 text-sm font-medium">
          <ThemeToggle />
          <Link href={siteConfig.routes.login} className="text-slate-600 hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300">
            Entrar
          </Link>
          <Link
            href={siteConfig.routes.signup}
            className="rounded-card bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            Criar conta
          </Link>
        </nav>
      </div>
    </header>
  );
}
