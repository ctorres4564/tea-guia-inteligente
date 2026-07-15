import { describe, expect, it } from "vitest";

import { ADMIN_ROLES, CONTENT_EDITOR_ROLES, REVIEWER_ROLES } from "@/lib/security/authorization";
import { profileRoleSchema } from "@/lib/validation/profile.schema";

describe("grupos de papéis do painel administrativo", () => {
  it("todos os papéis usados são válidos segundo profileRoleSchema", () => {
    for (const role of [...CONTENT_EDITOR_ROLES, ...REVIEWER_ROLES, ...ADMIN_ROLES]) {
      expect(profileRoleSchema.safeParse(role).success).toBe(true);
    }
  });

  it("CONTENT_EDITOR_ROLES inclui professional, reviewer e administrator", () => {
    expect(CONTENT_EDITOR_ROLES).toEqual(
      expect.arrayContaining(["professional", "reviewer", "administrator"]),
    );
  });

  it("REVIEWER_ROLES nunca inclui 'family' ou 'educator'", () => {
    expect(REVIEWER_ROLES).not.toContain("family");
    expect(REVIEWER_ROLES).not.toContain("educator");
  });

  it("ADMIN_ROLES contém apenas administrator", () => {
    expect(ADMIN_ROLES).toEqual(["administrator"]);
  });
});
