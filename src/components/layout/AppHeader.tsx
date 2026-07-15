import Link from "next/link";

import { siteConfig } from "@/config/site";

export function AppHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href={siteConfig.routes.home} className="text-lg font-semibold text-brand-700">
          {siteConfig.name}
        </Link>
        <nav className="flex items-center gap-3 text-sm font-medium">
          <Link href={siteConfig.routes.login} className="text-slate-600 hover:text-brand-700">
            Entrar
          </Link>
          <Link
            href={siteConfig.routes.signup}
            className="rounded-card bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
          >
            Criar conta
          </Link>
        </nav>
      </div>
    </header>
  );
}
