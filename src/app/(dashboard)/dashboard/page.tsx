import { redirect } from "next/navigation";

import { Alert, Card, PageHeader } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { getProfileAsAdmin } from "@/domains/users/admin-repository";
import { getSessionUser } from "@/lib/security/session";

const ROLE_LABELS: Record<string, string> = {
  family: "Família / Responsável",
  educator: "Educador(a)",
  professional: "Profissional",
  reviewer: "Revisor(a)",
  administrator: "Administrador(a)",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  blocked: "Bloqueado",
  pending: "Pendente",
};

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect(siteConfig.routes.login);
  }

  const profile = await getProfileAsAdmin(sessionUser.uid);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={profile ? `Olá, ${profile.fullName.split(" ")[0]}` : "Olá"}
        description="Este é o seu painel inicial."
      />

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sua conta</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Nome</dt>
            <dd className="text-sm font-medium text-slate-900">{profile?.fullName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">E-mail</dt>
            <dd className="text-sm font-medium text-slate-900">
              {profile?.email ?? sessionUser.email ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Papel</dt>
            <dd className="text-sm font-medium text-slate-900">
              {profile ? ROLE_LABELS[profile.role] ?? profile.role : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Status</dt>
            <dd className="text-sm font-medium text-slate-900">
              {profile ? STATUS_LABELS[profile.status] ?? profile.status : "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <Alert variant="info">
        Os módulos de chat, busca, biblioteca, favoritos e histórico estão em desenvolvimento e
        serão liberados nas próximas etapas do projeto.
      </Alert>
    </div>
  );
}
