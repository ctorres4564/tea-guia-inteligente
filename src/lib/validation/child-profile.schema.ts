import { z } from "zod";

/**
 * Modelagem de `children/{userId}/profiles/{childId}` (Fase 7).
 *
 * Dados sensíveis: este perfil pode conter informação de saúde de uma
 * criança (status diagnóstico). Por isso:
 *  - é acessível apenas pelo próprio responsável (dono da conta),
 *    nunca por outros usuários — reforçado em `firebase/firestore.rules`;
 *  - não é usado para nenhum fim além de personalizar o tom e os exemplos
 *    do assistente de IA dentro da própria conta (ver ADR-005);
 *  - nunca é tratado como fonte de diagnóstico — o app não diagnostica.
 */

export const diagnosisStatusSchema = z.enum([
  "not_diagnosed",
  "in_evaluation",
  "diagnosed",
]);
export type DiagnosisStatus = z.infer<typeof diagnosisStatusSchema>;

export const supportLevelSchema = z.enum(["level_1", "level_2", "level_3"]);
export type SupportLevel = z.infer<typeof supportLevelSchema>;

export const communicationStyleSchema = z.enum([
  "verbal",
  "verbal_with_support",
  "minimally_verbal",
  "non_verbal",
  "uses_aac",
]);
export type CommunicationStyle = z.infer<typeof communicationStyleSchema>;

export const childProfileSchema = z.object({
  id: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(1, "Informe um nome ou apelido")
    .max(60, "Nome muito longo"),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento deve estar no formato AAAA-MM-DD")
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
    }, "Data de nascimento inválida"),
  diagnosisStatus: diagnosisStatusSchema,
  supportLevel: supportLevelSchema.nullable().optional(),
  communicationStyle: communicationStyleSchema.nullable().optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  sensitivities: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  notes: z.string().trim().max(500).optional().default(""),
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
});
export type ChildProfile = z.infer<typeof childProfileSchema>;

/**
 * Payload de formulário (criação/edição) — mesmos campos, sem id/timestamps.
 */
export const childProfileFormSchema = childProfileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ChildProfileFormInput = z.infer<typeof childProfileFormSchema>;

export const DIAGNOSIS_STATUS_LABELS: Record<DiagnosisStatus, string> = {
  not_diagnosed: "Sem diagnóstico",
  in_evaluation: "Em avaliação",
  diagnosed: "Diagnosticado(a)",
};

export const SUPPORT_LEVEL_LABELS: Record<SupportLevel, string> = {
  level_1: "Nível 1 (apoio menos substancial)",
  level_2: "Nível 2 (apoio substancial)",
  level_3: "Nível 3 (apoio muito substancial)",
};

export const COMMUNICATION_STYLE_LABELS: Record<CommunicationStyle, string> = {
  verbal: "Verbal",
  verbal_with_support: "Verbal com apoio",
  minimally_verbal: "Minimamente verbal",
  non_verbal: "Não verbal",
  uses_aac: "Usa Comunicação Alternativa (CAA/PECS)",
};
