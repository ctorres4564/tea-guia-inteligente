import Link from "next/link";

import { siteConfig } from "@/config/site";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold text-slate-900">Página não encontrada</h1>
      <p className="max-w-md text-slate-500">
        O conteúdo que você procura não existe ou foi movido.
      </p>
      <Link href={siteConfig.routes.home} className="text-brand-700 hover:underline">
        Voltar para o início
      </Link>
    </div>
  );
}
