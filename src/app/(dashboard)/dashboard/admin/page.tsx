import { Card, PageHeader } from "@/components/ui";
import { getDashboardStats } from "@/domains/administration/stats";

const STAT_LABELS: Array<{ key: keyof Awaited<ReturnType<typeof getDashboardStats>>; label: string }> = [
  { key: "totalCategories", label: "Categorias (total)" },
  { key: "publishedCategories", label: "Categorias publicadas" },
  { key: "totalKnowledgeItems", label: "Conteúdos (total)" },
  { key: "publishedKnowledgeItems", label: "Conteúdos publicados" },
  { key: "inReviewKnowledgeItems", label: "Em revisão" },
  { key: "draftKnowledgeItems", label: "Rascunhos" },
];

export default async function AdminOverviewPage() {
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Painel administrativo"
        description="Gestão de categorias e conteúdos da base de conhecimento clínica."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {STAT_LABELS.map(({ key, label }) => (
          <Card key={key}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{stats[key]}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
