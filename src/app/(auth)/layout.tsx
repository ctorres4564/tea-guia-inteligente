import Link from "next/link";
import type { ReactNode } from "react";

import { siteConfig } from "@/config/site";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="px-4 py-6 sm:px-6">
        <Link href={siteConfig.routes.home} className="text-lg font-semibold text-brand-700">
          {siteConfig.name}
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
