import { describe, expect, it } from "vitest";

import { forgotPasswordSchema, loginSchema, signupSchema } from "@/lib/validation/auth.schema";

describe("loginSchema", () => {
  it("aceita e-mail e senha válidos", () => {
    const result = loginSchema.safeParse({ email: "mae@exemplo.com", password: "qualquer" });
    expect(result.success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    const result = loginSchema.safeParse({ email: "não-e-mail", password: "123" });
    expect(result.success).toBe(false);
  });

  it("rejeita senha vazia", () => {
    const result = loginSchema.safeParse({ email: "mae@exemplo.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  const base = {
    fullName: "Mariana Souza",
    email: "mariana@exemplo.com",
    password: "Senha1234",
    confirmPassword: "Senha1234",
    acceptTerms: true,
  };

  it("aceita dados válidos", () => {
    expect(signupSchema.safeParse(base).success).toBe(true);
  });

  it("rejeita quando as senhas não coincidem", () => {
    const result = signupSchema.safeParse({ ...base, confirmPassword: "Outra123" });
    expect(result.success).toBe(false);
  });

  it("rejeita senha fraca (sem maiúscula/número)", () => {
    const result = signupSchema.safeParse({ ...base, password: "abcdefgh", confirmPassword: "abcdefgh" });
    expect(result.success).toBe(false);
  });

  it("rejeita quando os termos não são aceitos", () => {
    const result = signupSchema.safeParse({ ...base, acceptTerms: false });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("exige e-mail válido", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });
});
