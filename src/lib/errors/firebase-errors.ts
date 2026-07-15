import { AppError } from "./app-error";

/**
 * Mapeamento de códigos de erro do Firebase (Authentication, Firestore, Storage)
 * para mensagens compreensíveis em português. Nunca repassar mensagens técnicas
 * originais do Firebase diretamente ao usuário.
 */
const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  // Authentication
  "auth/email-already-in-use": "Este e-mail já está cadastrado. Tente entrar ou recuperar sua senha.",
  "auth/invalid-email": "O e-mail informado é inválido.",
  "auth/weak-password": "A senha é muito fraca. Use pelo menos 8 caracteres, com letras e números.",
  "auth/user-disabled": "Esta conta foi desativada. Entre em contato com o suporte.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente.",
  "auth/popup-closed-by-user": "A janela de autenticação foi fechada antes de concluir.",
  "auth/requires-recent-login": "Por segurança, faça login novamente para continuar.",
  "auth/expired-action-code": "Este link expirou. Solicite um novo.",
  "auth/invalid-action-code": "Este link não é mais válido. Solicite um novo.",

  // Firestore
  "permission-denied": "Você não tem permissão para realizar esta ação.",
  "not-found": "O conteúdo solicitado não foi encontrado.",
  unavailable: "O serviço está temporariamente indisponível. Tente novamente em instantes.",
  "resource-exhausted": "Limite de uso atingido. Tente novamente mais tarde.",
  "deadline-exceeded": "A operação demorou mais do que o esperado. Tente novamente.",

  // Storage
  "storage/unauthorized": "Você não tem permissão para acessar este arquivo.",
  "storage/canceled": "O upload foi cancelado.",
  "storage/unknown": "Ocorreu um erro inesperado ao processar o arquivo.",
  "storage/object-not-found": "Arquivo não encontrado.",
  "storage/quota-exceeded": "Limite de armazenamento atingido.",
};

const DEFAULT_MESSAGE = "Ocorreu um erro inesperado. Tente novamente em instantes.";

function extractFirebaseCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/**
 * Converte qualquer erro do Firebase (ou desconhecido) em um AppError seguro,
 * com mensagem em português apropriada para exibição ao usuário.
 * O erro original é preservado em `cause` apenas para log interno.
 */
export function mapFirebaseError(error: unknown): AppError {
  const code = extractFirebaseCode(error);

  if (code) {
    const message = FIREBASE_ERROR_MESSAGES[code];
    if (message) {
      if (code.startsWith("auth/invalid-credential") || code === "auth/user-not-found" || code === "auth/wrong-password") {
        return new AppError("auth/invalid-credentials", message, error);
      }
      if (code === "permission-denied" || code === "storage/unauthorized") {
        return new AppError("auth/unauthorized", message, error);
      }
      if (code === "not-found" || code === "storage/object-not-found") {
        return new AppError("resource/not-found", message, error);
      }
      if (code === "unavailable" || code === "auth/network-request-failed") {
        return new AppError("service/unavailable", message, error);
      }
      return new AppError("unknown", message, error);
    }
  }

  return new AppError("unknown", DEFAULT_MESSAGE, error);
}

/**
 * Mensagem segura pronta para exibição, a partir de qualquer erro capturado.
 */
export function getSafeErrorMessage(error: unknown): string {
  return mapFirebaseError(error).message;
}
