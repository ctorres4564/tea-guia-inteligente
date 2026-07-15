import { describe, expect, it } from "vitest";

import { getSafeErrorMessage, mapFirebaseError } from "@/lib/errors/firebase-errors";

describe("mapFirebaseError", () => {
  it("mapeia auth/user-not-found para mensagem segura em português", () => {
    const appError = mapFirebaseError({ code: "auth/user-not-found", message: "internal detail" });
    expect(appError.code).toBe("auth/invalid-credentials");
    expect(appError.message).toBe("E-mail ou senha incorretos.");
    expect(appError.message).not.toMatch(/internal detail/);
  });

  it("mapeia permission-denied para unauthorized", () => {
    const appError = mapFirebaseError({ code: "permission-denied" });
    expect(appError.code).toBe("auth/unauthorized");
  });

  it("usa mensagem padrão para erros desconhecidos", () => {
    const appError = mapFirebaseError(new Error("algo obscuro"));
    expect(appError.message).toBe("Ocorreu um erro inesperado. Tente novamente em instantes.");
  });

  it("getSafeErrorMessage nunca expõe o erro técnico original", () => {
    const message = getSafeErrorMessage({ code: "auth/wrong-password", message: "stack trace..." });
    expect(message).not.toMatch(/stack trace/);
  });
});
