"use client";

import { useState } from "react";

import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { slugify } from "@/lib/utils/slug";
import type { KnowledgeItemFormInput } from "@/domains/knowledge/service";
import type { Category } from "@/lib/validation/category.schema";
import type { EvidenceLevel, TargetAudience } from "@/lib/validation/knowledge.schema";

const TARGET_AUDIENCE_OPTIONS: Array<{ value: TargetAudience; label: string }> = [
  { value: "family", label: "Família / Responsável" },
  { value: "educator", label: "Educador(a)" },
  { value: "professional", label: "Profissional" },
  { value: "general", label: "Geral" },
];

const EVIDENCE_LEVEL_OPTIONS: Array<{ value: EvidenceLevel; label: string }> = [
  { value: "low", label: "Baixo" },
  { value: "moderate", label: "Moderado" },
  { value: "high", label: "Alto" },
  { value: "expert_consensus", label: "Consenso de especialistas" },
];

export interface KnowledgeItemFormProps {
  categories: Category[];
  initialValues?: Partial<KnowledgeItemFormInput>;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: KnowledgeItemFormInput) => Promise<void> | void;
}

export function KnowledgeItemForm({
  categories,
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
}: KnowledgeItemFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialValues?.slug));
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? categories[0]?.id ?? "");
  const [summary, setSummary] = useState(initialValues?.summary ?? "");
  const [content, setContent] = useState(initialValues?.content ?? "");
  const [ageRange, setAgeRange] = useState(initialValues?.ageRange ?? "");
  const [tagsInput, setTagsInput] = useState((initialValues?.tags ?? []).join(", "));
  const [evidenceLevel, setEvidenceLevel] = useState<EvidenceLevel>(
    initialValues?.evidenceLevel ?? "moderate",
  );
  const [targetAudience, setTargetAudience] = useState<TargetAudience[]>(
    initialValues?.targetAudience ?? ["family"],
  );

  function toggleAudience(value: TargetAudience) {
    setTargetAudience((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit({
      title,
      slug: slug || slugify(title),
      categoryId,
      summary,
      content,
      ageRange: ageRange || undefined,
      tags: tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      evidenceLevel,
      targetAudience: targetAudience.length > 0 ? targetAudience : ["family"],
    });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Título" htmlFor="ki-title">
          <Input
            id="ki-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            required
          />
        </FormField>
        <FormField label="Slug" htmlFor="ki-slug">
          <Input
            id="ki-slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            required
          />
        </FormField>
      </div>

      <FormField label="Categoria" htmlFor="ki-category">
        <Select id="ki-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
          <option value="" disabled>
            Selecione uma categoria
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Resumo" htmlFor="ki-summary" hint="Até 400 caracteres — usado em listagens.">
        <Textarea id="ki-summary" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} required />
      </FormField>

      <FormField label="Conteúdo completo" htmlFor="ki-content">
        <Textarea
          id="ki-content"
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </FormField>

      <div>
        <p className="text-sm font-medium text-slate-700">Público-alvo</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {TARGET_AUDIENCE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={targetAudience.includes(option.value)}
                onChange={() => toggleAudience(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Faixa etária" htmlFor="ki-age" hint="Ex.: 2 a 5 anos">
          <Input id="ki-age" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
        </FormField>
        <FormField label="Nível de evidência" htmlFor="ki-evidence">
          <Select
            id="ki-evidence"
            value={evidenceLevel}
            onChange={(e) => setEvidenceLevel(e.target.value as EvidenceLevel)}
          >
            {EVIDENCE_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Tags" htmlFor="ki-tags" hint="Separadas por vírgula">
          <Input id="ki-tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
        </FormField>
      </div>

      <div>
        <Button type="submit" isLoading={isSubmitting} disabled={categories.length === 0}>
          {submitLabel}
        </Button>
        {categories.length === 0 && (
          <p className="mt-2 text-xs text-red-600">
            Crie ao menos uma categoria antes de cadastrar conteúdos.
          </p>
        )}
      </div>
    </form>
  );
}
