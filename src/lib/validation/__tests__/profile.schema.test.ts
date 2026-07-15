import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROFILE_ROLE,
  DEFAULT_PROFILE_STATUS,
  profileSchema,
  profileSelfUpdateSchema,
} from "@/lib/validation/profile.schema";

describe("profileSchema", () => {
  it("aceita um perfil válido", () => {
    const result = profileSchema.safeParse({
      uid: "abc123",
      fullName: "Mariana Souza",
      email: "mariana@exemplo.com",
      role: DEFAULT_PROFILE_ROLE,
      status: DEFAULT_PROFILE_STATUS,
      avatarUrl: null,
      createdAt: null,
      updatedAt: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita papel inválido", () => {
    const result = profileSchema.safeParse({
      uid: "abc123",
      fullName: "Mariana Souza",
      email: "mariana@exemplo.com",
      role: "super-admin",
      status: DEFAULT_PROFILE_STATUS,
      createdAt: null,
      updatedAt: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("profileSelfUpdateSchema", () => {
  it("não possui os campos role/status no schema de autoatualização", () => {
    const shape = profileSelfUpdateSchema.shape;
    expect(shape).not.toHaveProperty("role");
    expect(shape).not.toHaveProperty("status");
  });
});
