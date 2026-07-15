import Link from "next/link";

import { DisclaimerBanner } from "@/components/feedback/DisclaimerBanner";
import { Card } from "@/components/ui";
import { siteConfig } from "@/config/site";

const BENEFITS = [
  {
    title: "Conteúdo confiável",
    description: "Informações organizadas para serem revisadas por especialistas, com referências claras.",
  },
  {
    title: "Linguagem acessível",
    description: "Explicações em português simples, pensadas para o dia a dia da família.",
  },
  {
    title: "Tudo em um só lugar",
    description: "Sem depender de buscas dispersas em redes sociais, fóruns e vídeos aleatórios.",
  },
];

const HOW_IT_WORKS = [
  { step: "1. Você faz uma pergunta ou busca um tema.", },
  { step: "2. O conteúdo é organizado a partir de uma base de conhecimento estruturada." },
  { step: "3. Você recebe uma resposta clara, com referências e sugestões relacionadas." },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 sm:px-6">
      <section className="flex flex-col items-start gap-6">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand-700">
          Em desenvolvimento — MVP
        </span>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          {siteConfig.name}
        </h1>
        <p className="max-w-xl text-lg text-slate-600">{siteConfig.shortDescription}</p>

        <div className="flex flex-wrap gap-3">
          <Link
            href={siteConfig.routes.signup}
            className="rounded-card bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Criar conta
          </Link>
          <Link
            href={siteConfig.routes.login}
            className="rounded-card border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Entrar
          </Link>
        </div>

        <div className="max-w-2xl">
          <DisclaimerBanner />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Para quem é o {siteConfig.name}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {siteConfig.audience.map((item) => (
            <li
              key={item}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-700"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-slate-900">Principais benefícios</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <Card key={benefit.title}>
              <h3 className="font-semibold text-slate-900">{benefit.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{benefit.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold text-slate-900">Como vai funcionar</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          As funcionalidades abaixo estão em construção e serão liberadas gradualmente.
        </p>
        <ol className="mt-6 flex flex-col gap-3">
          {HOW_IT_WORKS.map((item) => (
            <li
              key={item.step}
              className="rounded-card border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
            >
              {item.step}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
