import { redirect } from "next/navigation";

import { Card, PageHeader } from "@/components/ui";
import { SearchInterface } from "@/components/SearchInterface";
import { siteConfig } from "@/config/site";
import { getProfileAsAdmin } from "@/domains/users/admin-repository";
import { getSessionUser } from "@/lib/security/session";
import { getAdminFirestore } from "@/lib/firebase/admin";

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

async function getCategoriesServer() {
  try {
    const db = getAdminFirestore();
    const snapshot = await db
      .collection("categories")
      .where("status", "==", "published")
      .orderBy("displayOrder", "asc")
      .get();

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: data.name as string,
        slug: data.slug as string,
      };
    });
  } catch (error) {
    console.error("Erro ao listar categorias no servidor:", error);
    return [];
  }
}

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect(siteConfig.routes.login);
  }

  const profile = await getProfileAsAdmin(sessionUser.uid);
  const categories = await getCategoriesServer();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={profile ? `Olá, ${profile.fullName.split(" ")[0]}` : "Olá"}
        description="Pesquise orientações clínicas na base de conhecimento ou gerencie sua conta."
      />

      {/* Busca Semântica Avançada com IA */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-3">Busca Inteligente com IA</h3>
        <SearchInterface categories={categories} />
      </div>

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
    </div>
  );
}
