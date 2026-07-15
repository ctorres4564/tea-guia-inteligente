"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, Card, PageHeader } from "@/components/ui";
import { KnowledgeItemForm } from "@/components/admin/KnowledgeItemForm";
import { useAuth } from "@/hooks/useAuth";
import { listCategories } from "@/domains/categories/service";
import { createKnowledgeItem, type KnowledgeItemFormInput } from "@/domains/knowledge/service";
import { isAppError } from "@/lib/errors/app-error";
import type { Category } from "@/lib/validation/category.schema";

export default function NewKnowledgeItemPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((err) => setError(isAppError(err) ? err.message : "Não foi possível carregar as categorias."));
  }, []);

  async function handleSubmit(values: KnowledgeItemFormInput) {
    if (!user) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const id = await createKnowledgeItem(values, user.uid);
      router.push(`/dashboard/admin/conteudos/${id}`);
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível criar o conteúdo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Novo conteúdo" description="A ficha é criada como rascunho." />
      {error && (
        <Alert variant="error" role="alert">
          {error}
        </Alert>
      )}
      <Card>
        <KnowledgeItemForm
          categories={categories}
          submitLabel="Criar rascunho"
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
        />
      </Card>
    </div>
  );
}
