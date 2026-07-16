"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Alert, Button, Card, EmptyState, Loading, PageHeader, Select } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { listCategories } from "@/domains/categories/service";
import {
  approveKnowledgeItem,
  listKnowledgeItems,
  publishKnowledgeItem,
  rejectKnowledgeItem,
  restoreKnowledgeItem,
  softDeleteKnowledgeItem,
  submitKnowledgeItemForReview,
} from "@/domains/knowledge/service";
import { isAppError } from "@/lib/errors/app-error";
import type { Category } from "@/lib/validation/category.schema";
import type { KnowledgeItem, ReviewStatus } from "@/lib/validation/knowledge.schema";

const STATUS_LABELS: Record<ReviewStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovado",
  published: "Publicado",
  rejected: "Rejeitado",
};

const STATUS_BADGE: Record<ReviewStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  in_review: "bg-blue-100 text-blue-700",
  approved: "bg-teal-100 text-teal-700",
  published: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function KnowledgeItemsAdminPage() {
  const { profile } = useAuth();
  const isReviewer = profile?.role === "reviewer" || profile?.role === "administrator";
  const isAdmin = profile?.role === "administrator";

  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleReprocessEmbeddings() {
    setIsReprocessing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/embeddings/reprocess", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao conciliar embeddings.");
      }
      alert(`Sincronização concluída! Itens reprocessados: ${data.processedCount}`);
      await refresh();
    } catch (err: any) {
      setError(err.message || "Erro na conciliação de embeddings.");
    } finally {
      setIsReprocessing(false);
    }
  }

  async function refresh() {
    setIsLoading(true);
    try {
      const [itemsData, categoriesData] = await Promise.all([
        listKnowledgeItems({ includeDeleted: true }),
        listCategories(),
      ]);
      setItems(itemsData);
      setCategories(categoriesData);
      setError(null);
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível carregar os conteúdos.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const categoryNameById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const filteredItems = items.filter((item) => statusFilter === "all" || item.reviewStatus === statusFilter);

  async function runAction(id: string, action: () => Promise<void>) {
    setBusyId(id);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível concluir a ação.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conteúdos"
        description="Fichas da base de conhecimento clínica."
        actions={
          <div className="flex gap-2">
            {isAdmin && (
              <Button
                variant="secondary"
                onClick={handleReprocessEmbeddings}
                disabled={isReprocessing}
              >
                {isReprocessing ? "Sincronizando..." : "Sincronizar Embeddings"}
              </Button>
            )}
            <Link href="/dashboard/admin/conteudos/novo">
              <Button>Novo conteúdo</Button>
            </Link>
          </div>
        }
      />

      {error && (
        <Alert variant="error" role="alert">
          {error}
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <label htmlFor="status-filter" className="text-sm font-medium text-slate-700">
          Filtrar por status
        </label>
        <Select
          id="status-filter"
          className="w-56"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReviewStatus | "all")}
        >
          <option value="all">Todos</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <Loading label="Carregando conteúdos..." />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="Nenhum conteúdo encontrado"
          description="Cadastre o primeiro conteúdo clicando em “Novo conteúdo”."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className={item.deletedAt ? "opacity-60" : ""}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/admin/conteudos/${item.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {item.title}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[item.reviewStatus]}`}>
                      {STATUS_LABELS[item.reviewStatus]}
                    </span>
                    {Boolean(item.deletedAt) && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-500">
                        Excluído (lógico)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {categoryNameById[item.categoryId] ?? "Categoria não encontrada"} · versão {item.version}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{item.summary}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.reviewStatus === "draft" && !item.deletedAt && (
                    <Button
                      variant="secondary"
                      isLoading={busyId === item.id}
                      onClick={() => runAction(item.id, () => submitKnowledgeItemForReview(item.id))}
                    >
                      Enviar para revisão
                    </Button>
                  )}

                  {isReviewer && item.reviewStatus === "in_review" && profile && (
                    <>
                      <Button
                        variant="secondary"
                        isLoading={busyId === item.id}
                        onClick={() => runAction(item.id, () => approveKnowledgeItem(item.id, profile.uid))}
                      >
                        Aprovar
                      </Button>
                      <Button
                        variant="danger"
                        isLoading={busyId === item.id}
                        onClick={() => runAction(item.id, () => rejectKnowledgeItem(item.id, profile.uid))}
                      >
                        Rejeitar
                      </Button>
                    </>
                  )}

                  {isReviewer && item.reviewStatus === "approved" && profile && (
                    <Button
                      isLoading={busyId === item.id}
                      onClick={() => runAction(item.id, () => publishKnowledgeItem(item.id, profile.uid))}
                    >
                      Publicar
                    </Button>
                  )}

                  {isAdmin && !item.deletedAt && (
                    <Button
                      variant="danger"
                      isLoading={busyId === item.id}
                      onClick={() => runAction(item.id, () => softDeleteKnowledgeItem(item.id))}
                    >
                      Excluir
                    </Button>
                  )}

                  {isAdmin && Boolean(item.deletedAt) && (
                    <Button
                      variant="secondary"
                      isLoading={busyId === item.id}
                      onClick={() => runAction(item.id, () => restoreKnowledgeItem(item.id))}
                    >
                      Restaurar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
