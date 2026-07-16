"use client";

import { useEffect, useState } from "react";

import {
  Alert,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  Loading,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { createChild, deleteChild, listChildren, updateChild } from "@/domains/children/service";
import { isAppError } from "@/lib/errors/app-error";
import { formatAgeLabel } from "@/lib/utils/age";
import {
  COMMUNICATION_STYLE_LABELS,
  DIAGNOSIS_STATUS_LABELS,
  SUPPORT_LEVEL_LABELS,
  type ChildProfile,
  type ChildProfileFormInput,
  type CommunicationStyle,
  type DiagnosisStatus,
  type SupportLevel,
} from "@/lib/validation/child-profile.schema";

const EMPTY_FORM: ChildProfileFormInput = {
  name: "",
  birthDate: "",
  diagnosisStatus: "not_diagnosed",
  supportLevel: null,
  communicationStyle: null,
  interests: [],
  sensitivities: [],
  notes: "",
};

export default function ChildrenProfilesPage() {
  const { user } = useAuth();

  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChildProfileFormInput>(EMPTY_FORM);
  const [interestsInput, setInterestsInput] = useState("");
  const [sensitivitiesInput, setSensitivitiesInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function refresh() {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await listChildren(user.uid);
      setChildren(data);
      setError(null);
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível carregar os perfis.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function startEdit(child: ChildProfile) {
    setEditingId(child.id);
    setForm({
      name: child.name,
      birthDate: child.birthDate,
      diagnosisStatus: child.diagnosisStatus,
      supportLevel: child.supportLevel ?? null,
      communicationStyle: child.communicationStyle ?? null,
      interests: child.interests,
      sensitivities: child.sensitivities,
      notes: child.notes ?? "",
    });
    setInterestsInput(child.interests.join(", "));
    setSensitivitiesInput(child.sensitivities.join(", "));
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setInterestsInput("");
    setSensitivitiesInput("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setError(null);

    const payload: ChildProfileFormInput = {
      ...form,
      interests: interestsInput
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      sensitivities: sensitivitiesInput
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      supportLevel: form.diagnosisStatus === "diagnosed" ? form.supportLevel : null,
    };

    try {
      if (editingId) {
        await updateChild(user.uid, editingId, payload);
      } else {
        await createChild(user.uid, payload);
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível salvar o perfil.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(childId: string) {
    if (!user) return;
    setError(null);
    try {
      await deleteChild(user.uid, childId);
      if (editingId === childId) resetForm();
      await refresh();
    } catch (err) {
      setError(isAppError(err) ? err.message : "Não foi possível excluir o perfil.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Perfil da criança"
        description="Cadastre informações da criança para personalizar o tom das respostas do assistente de IA. Esses dados nunca são usados para diagnóstico e ficam visíveis apenas para você."
      />

      {error && (
        <Alert variant="error" role="alert">
          {error}
        </Alert>
      )}

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {editingId ? "Editar perfil" : "Novo perfil"}
        </h2>
        <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nome ou apelido" htmlFor="child-name">
              <Input
                id="child-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                maxLength={60}
              />
            </FormField>
            <FormField label="Data de nascimento" htmlFor="child-birth">
              <Input
                id="child-birth"
                type="date"
                value={form.birthDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
                required
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Status diagnóstico" htmlFor="child-diagnosis">
              <Select
                id="child-diagnosis"
                value={form.diagnosisStatus}
                onChange={(e) =>
                  setForm((f) => ({ ...f, diagnosisStatus: e.target.value as DiagnosisStatus }))
                }
              >
                {Object.entries(DIAGNOSIS_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label="Nível de suporte"
              htmlFor="child-support"
              hint={form.diagnosisStatus !== "diagnosed" ? "Aplicável apenas quando diagnosticado(a)" : undefined}
            >
              <Select
                id="child-support"
                value={form.supportLevel ?? ""}
                disabled={form.diagnosisStatus !== "diagnosed"}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    supportLevel: (e.target.value || null) as SupportLevel | null,
                  }))
                }
              >
                <option value="">Não informado</option>
                {Object.entries(SUPPORT_LEVEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Comunicação" htmlFor="child-communication">
              <Select
                id="child-communication"
                value={form.communicationStyle ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    communicationStyle: (e.target.value || null) as CommunicationStyle | null,
                  }))
                }
              >
                <option value="">Não informado</option>
                {Object.entries(COMMUNICATION_STYLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Interesses" htmlFor="child-interests" hint="Separados por vírgula">
              <Input
                id="child-interests"
                value={interestsInput}
                onChange={(e) => setInterestsInput(e.target.value)}
                placeholder="dinossauros, música, trens"
              />
            </FormField>
            <FormField
              label="Sensibilidades"
              htmlFor="child-sensitivities"
              hint="Separadas por vírgula"
            >
              <Input
                id="child-sensitivities"
                value={sensitivitiesInput}
                onChange={(e) => setSensitivitiesInput(e.target.value)}
                placeholder="sons altos, luzes fortes"
              />
            </FormField>
          </div>

          <FormField label="Observações" htmlFor="child-notes" hint="Opcional, até 500 caracteres">
            <Textarea
              id="child-notes"
              rows={3}
              maxLength={500}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </FormField>

          <div className="flex gap-2">
            <Button type="submit" isLoading={isSaving}>
              {editingId ? "Salvar alterações" : "Cadastrar perfil"}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancelar edição
              </Button>
            )}
          </div>
        </form>
      </Card>

      {isLoading ? (
        <Loading label="Carregando perfis..." />
      ) : children.length === 0 ? (
        <EmptyState
          title="Nenhum perfil cadastrado"
          description="Cadastre o perfil da criança acima para receber respostas mais personalizadas no assistente de IA."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {children.map((child) => (
            <Card key={child.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium text-slate-900">
                  {child.name}{" "}
                  <span className="font-normal text-slate-500">
                    · {formatAgeLabel(child.birthDate)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {DIAGNOSIS_STATUS_LABELS[child.diagnosisStatus]}
                  {child.supportLevel ? ` · ${SUPPORT_LEVEL_LABELS[child.supportLevel]}` : ""}
                  {child.communicationStyle
                    ? ` · ${COMMUNICATION_STYLE_LABELS[child.communicationStyle]}`
                    : ""}
                </p>
                {child.interests.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">Interesses: {child.interests.join(", ")}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => startEdit(child)}>
                  Editar
                </Button>
                <Button variant="danger" onClick={() => handleDelete(child.id)}>
                  Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
