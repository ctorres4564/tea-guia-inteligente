"use client";

import { useEffect, useState } from "react";

import { Alert, Button, Card, EmptyState, FormField, Input, Loading, PageHeader, Select, Textarea } from "@/components/ui";
import {
  createCategory,
  listCategories,
  setCategoryStatus,
  updateCategory,
} from "@/domains/categories/service";
import { isAppError } from "@/lib/errors/app-error";
import { slugify } from "@/lib/utils/slug";
import type { Category, CategoryStatus } from "@/lib/validation/category.schema";

const STATUS_LABELS: Record<CategoryStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  archived: "Arquivada",
};

const STATUS_BADGE: Record<CategoryStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  published: "bg-green-100 text-green-700",
  archived: "bg-amber-100 text-amber-700",
};

export default function CategoriesAdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function refresh() {
    setIsLoading(true);
    try {
      const data = await listCategories();
      setCategories(data);
      setError(null);
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível carregar as categorias.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await createCategory({
        name,
        slug: slug || slugify(name),
        description,
        displayOrder: categories.length,
      });
      setName("");
      setSlug("");
      setSlugTouched(false);
      setDescription("");
      await refresh();
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível criar a categoria.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(category: Category, status: CategoryStatus) {
    try {
      await setCategoryStatus(category.id, status);
      await refresh();
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível atualizar o status.");
    }
  }

  async function handleReorder(category: Category, direction: -1 | 1) {
    const index = categories.findIndex((c) => c.id === category.id);
    const target = categories[index + direction];
    if (!target) return;
    try {
      await Promise.all([
        updateCategory(category.id, { displayOrder: target.displayOrder }),
        updateCategory(target.id, { displayOrder: category.displayOrder }),
      ]);
      await refresh();
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível reordenar.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Categorias" description="Organize os temas da base de conhecimento clínica." />

      {error && (
        <Alert variant="error" role="alert">
          {error}
        </Alert>
      )}

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Nova categoria</h2>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
          <FormField label="Nome" htmlFor="cat-name">
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              required
            />
          </FormField>
          <FormField label="Slug" htmlFor="cat-slug" hint="Gerado automaticamente a partir do nome.">
            <Input
              id="cat-slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              required
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label="Descrição" htmlFor="cat-description">
              <Textarea
                id="cat-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" isLoading={isSaving}>
              Criar categoria (rascunho)
            </Button>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <Loading label="Carregando categorias..." />
      ) : categories.length === 0 ? (
        <EmptyState title="Nenhuma categoria cadastrada" description="Crie a primeira categoria acima." />
      ) : (
        <div className="flex flex-col gap-3">
          {categories.map((category, index) => (
            <Card key={category.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{category.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[category.status]}`}>
                    {STATUS_LABELS[category.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-500">/{category.slug}</p>
                {category.description && (
                  <p className="mt-1 text-sm text-slate-600">{category.description}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={() => handleReorder(category, -1)} disabled={index === 0}>
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleReorder(category, 1)}
                  disabled={index === categories.length - 1}
                >
                  ↓
                </Button>
                <Select
                  value={category.status}
                  onChange={(e) => handleStatusChange(category, e.target.value as CategoryStatus)}
                  className="w-40"
                >
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicada</option>
                  <option value="archived">Arquivada</option>
                </Select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
