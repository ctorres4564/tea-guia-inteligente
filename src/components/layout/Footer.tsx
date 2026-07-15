import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500 sm:px-6">
        <p className="max-w-2xl">{siteConfig.disclaimer}</p>
        <p className="mt-4">
          © {new Date().getFullYear()} {siteConfig.name}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
