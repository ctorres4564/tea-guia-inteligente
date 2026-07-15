import { z } from "zod";

/**
 * Validação das variáveis de ambiente usadas no CLIENTE (navegador).
 * Nunca inclua aqui variáveis administrativas (sem prefixo NEXT_PUBLIC_).
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, "NEXT_PUBLIC_FIREBASE_API_KEY é obrigatória"),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z
    .string()
    .min(1, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN é obrigatória"),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z
    .string()
    .min(1, "NEXT_PUBLIC_FIREBASE_PROJECT_ID é obrigatória"),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z
    .string()
    .min(1, "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET é obrigatória"),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z
    .string()
    .min(1, "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID é obrigatória"),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, "NEXT_PUBLIC_FIREBASE_APP_ID é obrigatória"),
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: z
    .enum(["true", "false"])
    .optional()
    .default("false"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

let cachedClientEnv: ClientEnv | null = null;

/**
 * Lê e valida as variáveis de ambiente públicas do Firebase.
 * Lança um erro descritivo em caso de configuração ausente ou inválida.
 */
export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) return cachedClientEnv;

  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(
      `Configuração inválida do Firebase (cliente). Verifique seu arquivo .env.local:\n${issues.join("\n")}`,
    );
  }

  cachedClientEnv = parsed.data;
  return cachedClientEnv;
}

export function isUsingEmulators(): boolean {
  return getClientEnv().NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" && process.env.NODE_ENV !== "production";
}

/**
 * Validação das variáveis de ambiente usadas apenas no SERVIDOR (Firebase Admin).
 * Nunca importe este módulo em código de cliente.
 */
const adminEnvSchema = z.object({
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1, "FIREBASE_ADMIN_PROJECT_ID é obrigatória"),
  FIREBASE_ADMIN_CLIENT_EMAIL: z
    .string()
    .email("FIREBASE_ADMIN_CLIENT_EMAIL deve ser um e-mail válido"),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1, "FIREBASE_ADMIN_PRIVATE_KEY é obrigatória"),
});

export type AdminEnv = z.infer<typeof adminEnvSchema>;

let cachedAdminEnv: AdminEnv | null = null;

export function getAdminEnv(): AdminEnv {
  if (cachedAdminEnv) return cachedAdminEnv;

  const parsed = adminEnvSchema.safeParse({
    FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID,
    FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(
      `Configuração inválida do Firebase Admin (servidor). Verifique suas variáveis de ambiente:\n${issues.join("\n")}`,
    );
  }

  cachedAdminEnv = parsed.data;
  return cachedAdminEnv;
}
