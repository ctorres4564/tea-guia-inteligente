"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, Button, Card, Loading, PageHeader } from "@/components/ui";
import { KnowledgeItemForm } from "@/components/admin/KnowledgeItemForm";
import { useAuth } from "@/hooks/useAuth";
import { listCategories } from "@/domains/categories/service";
import {
  approveKnowledgeItem,
  addKnowledgeItemAttachment,
  getKnowledgeItem,
  publishKnowledgeItem,
  rejectKnowledgeItem,
  removeKnowledgeItemAttachment,
  submitKnowledgeItemForReview,
  updateKnowledgeItemContent,
  type KnowledgeItemFormInput,
} from "@/domains/knowledge/service";
import { deleteKnowledgeAttachment, uploadKnowledgeAttachment } from "@/domains/knowledge/storage-service";
import { isAppError } from "@/lib/errors/app-error";
import type { Category } from "@/lib/validation/category.schema";
import type { KnowledgeAttachment, KnowledgeItem } from "@/lib/validation/knowledge.schema";

export default function EditKnowledgeItemPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const isReviewer = profile?.role === "reviewer" || profile?.role === "administrator";

  const [item, setItem] = useState<KnowledgeItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    setIsLoading(true);
    try {
      const [itemData, categoriesData] = await Promise.all([
        getKnowledgeItem(params.id),
        listCategories(),
      ]);
      if (!itemData) {
        setError("Conteúdo não encontrado.");
      } else {
        setItem(itemData);
      }
      setCategories(categoriesData);
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível carregar o conteúdo.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSubmit(values: KnowledgeItemFormInput) {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await updateKnowledgeItemContent(params.id, values);
      setNotice("Alterações salvas — uma nova versão foi criada.");
      await refresh();
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReviewAction(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível concluir a ação.");
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const uploaded = await uploadKnowledgeAttachment(params.id, file);
      await addKnowledgeItemAttachment(params.id, { ...uploaded, name: file.name });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemoveAttachment(attachment: KnowledgeAttachment) {
    setError(null);
    try {
      await removeKnowledgeItemAttachment(params.id, attachment);
      await deleteKnowledgeAttachment(attachment.path);
      await refresh();
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível remover o arquivo.");
    }
  }

  if (isLoading) return <Loading label="Carregando conteúdo..." />;

  if (!item) {
    return (
      <Alert variant="error" role="alert">
        {error ?? "Conteúdo não encontrado."}
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={item.title}
        description={`Versão ${item.version} · status: ${item.reviewStatus}`}
        actions={
          <Button variant="ghost" onClick={() => router.push("/dashboard/admin/conteudos")}>
            Voltar à lista
          </Button>
        }
      />

      {error && (
        <Alert variant="error" role="alert">
          {error}
        </Alert>
      )}
      {notice && <Alert variant="success">{notice}</Alert>}

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Fluxo de revisão</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.reviewStatus === "draft" && (
            <Button
              variant="secondary"
              onClick={() => handleReviewAction(() => submitKnowledgeItemForReview(item.id))}
            >
              Enviar para revisão
            </Button>
          )}
          {isReviewer && item.reviewStatus === "in_review" && profile && (
            <>
              <Button onClick={() => handleReviewAction(() => approveKnowledgeItem(item.id, profile.uid))}>
                Aprovar
              </Button>
              <Button
                variant="danger"
                onClick={() => handleReviewAction(() => rejectKnowledgeItem(item.id, profile.uid))}
              >
                Rejeitar
              </Button>
            </>
          )}
          {isReviewer && item.reviewStatus === "approved" && profile && (
            <Button onClick={() => handleReviewAction(() => publishKnowledgeItem(item.id, profile.uid))}>
              Publicar
            </Button>
          )}
          {item.reviewStatus === "published" && (
            <span className="text-sm text-green-700">Este conteúdo está publicado.</span>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Materiais de apoio</h2>
        <p className="mt-1 text-xs text-slate-500">PDF, PNG, JPG ou WEBP — até 5 MB.</p>

        <ul className="mt-3 flex flex-col gap-2">
          {item.attachments.length === 0 && (
            <li className="text-sm text-slate-500">Nenhum material anexado.</li>
          )}
          {item.attachments.map((attachment) => (
            <li
              key={attachment.path}
              className="flex items-center justify-between rounded-card border border-slate-200 px-3 py-2 text-sm"
            >
              <a href={attachment.url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                {attachment.name}
              </a>
              <Button variant="ghost" onClick={() => handleRemoveAttachment(attachment)}>
                Remover
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={handleUpload}
            disabled={isUploading}
            className="text-sm"
          />
          {isUploading && <p className="mt-1 text-xs text-slate-500">Enviando...</p>}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conteúdo</h2>
        <div className="mt-4">
          <KnowledgeItemForm
            categories={categories}
            initialValues={{
              title: item.title,
              slug: item.slug,
              categoryId: item.categoryId,
              summary: item.summary,
              content: item.content,
              ageRange: item.ageRange,
              tags: item.tags,
              evidenceLevel: item.evidenceLevel,
              targetAudience: item.targetAudience,
            }}
            submitLabel="Salvar alterações (nova versão)"
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
        </div>
      </Card>
    </div>
  );
}
