/**
 * Erro padronizado da aplicação.
 * `message` é sempre um texto seguro para exibição ao usuário final (em português).
 * `cause` guarda o erro original apenas para fins de log no servidor — nunca é exposto ao cliente.
 */
export type AppErrorCode =
  | "auth/invalid-credentials"
  | "auth/unauthenticated"
  | "auth/unauthorized"
  | "validation/invalid-input"
  | "resource/not-found"
  | "service/unavailable"
  | "network/offline"
  | "unknown";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = cause;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
