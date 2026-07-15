import { z } from "zod";

export const profileRoleSchema = z.enum([
  "family",
  "educator",
  "professional",
  "reviewer",
  "administrator",
]);
export type ProfileRole = z.infer<typeof profileRoleSchema>;

export const profileStatusSchema = z.enum(["active", "inactive", "blocked", "pending"]);
export type ProfileStatus = z.infer<typeof profileStatusSchema>;

/**
 * Papel padrão atribuído a todo novo cadastro.
 * Usuários nunca podem escolher papéis administrativos durante o cadastro.
 */
export const DEFAULT_PROFILE_ROLE: ProfileRole = "family";
export const DEFAULT_PROFILE_STATUS: ProfileStatus = "active";

export const profileSchema = z.object({
  uid: z.string().min(1),
  fullName: z.string().trim().min(2, "Informe o nome completo").max(120),
  email: z.string().email("E-mail inválido"),
  role: profileRoleSchema,
  status: profileStatusSchema,
  avatarUrl: z.string().url().nullable().optional(),
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
});
export type Profile = z.infer<typeof profileSchema>;

/**
 * Campos que o próprio usuário pode atualizar em seu perfil.
 * `role` e `status` nunca podem ser alterados pelo próprio usuário — apenas por administradores.
 */
export const profileSelfUpdateSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome completo").max(120).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});
export type ProfileSelfUpdate = z.infer<typeof profileSelfUpdateSchema>;
