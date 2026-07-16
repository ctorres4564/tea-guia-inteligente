"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils/cn";

interface SidebarItem {
  label: string;
  href: string;
  disabled?: boolean;
}

const ITEMS: SidebarItem[] = [
  { label: "Início", href: "/dashboard" },
  { label: "Chat com IA", href: "/dashboard/chat" },
  { label: "Biblioteca", href: "/dashboard/biblioteca", disabled: true },
  { label: "Favoritos", href: "/dashboard/favoritos" },
  { label: "Histórico", href: "/dashboard/historico" },
  { label: "Perfil da criança", href: "/dashboard/criancas" },
];

const ADMIN_ROLES = ["professional", "reviewer", "administrator"];

export function AppSidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const canSeeAdmin = profile ? ADMIN_ROLES.includes(profile.role) : false;

  const items = canSeeAdmin
    ? [...ITEMS, { label: "Painel administrativo", href: "/dashboard/admin" }]
    : ITEMS;

  return (
    <nav aria-label="Navegação do painel" className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <span key={item.href} className="relative">
            {item.disabled ? (
              <span
                className="flex items-center justify-between rounded-card px-3 py-2 text-sm text-slate-400 dark:text-slate-500"
                aria-disabled="true"
              >
                {item.label}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                  Em breve
                </span>
              </span>
            ) : (
              <Link
                href={item.href}
                className={cn(
                  "block rounded-card px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-400"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                )}
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
