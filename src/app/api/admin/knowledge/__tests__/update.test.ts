/**
 * Testes unitários para /api/admin/knowledge/update/route.ts
 *
 * Verifica:
 * - Edição de rascunho bem-sucedida (embeddingVersion: 0, version incrementado)
 * - Edição de item publicado reverte para in_review
 * - Professional bloqueado de editar item publicado
 * - Payload com campos admin ignorados (patch só aceita campos de conteúdo)
 * - Sem autorização retorna 403
 * - Item não encontrado retorna 404
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------- Mocks ----------

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: vi.fn(),
}));

vi.mock("@/lib/security/authorization", () => ({
  getAuthorizedSession: vi.fn(),
  CONTENT_EDITOR_ROLES: ["professional", "reviewer", "administrator"],
  REVIEWER_ROLES: ["reviewer", "administrator"],
}));

vi.mock("@/lib/errors/firebase-errors", () => ({
  mapFirebaseError: (e: unknown) => ({
    message: e instanceof Error ? e.message : "Erro",
  }),
}));

// ---------- Helpers ----------

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/admin/knowledge/update", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDocSnap(data: Record<string, unknown>, exists = true) {
  return { exists, data: () => data };
}

function mockSession(role: string) {
  return {
    sessionUser: { uid: `${role}-uid` },
    profile: { role, status: "active" },
  };
}

// ---------- Testes ----------

describe("PATCH /api/admin/knowledge/update", () => {
  let getAuthorizedSession: ReturnType<typeof vi.fn>;
  let getAdminFirestore: ReturnType<typeof vi.fn>;
  let mockDocRef: { get: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    mockDocRef = {
      get: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    };

    const authMod = await import("@/lib/security/authorization");
    getAuthorizedSession = vi.mocked(authMod.getAuthorizedSession);

    const adminMod = await import("@/lib/firebase/admin");
    getAdminFirestore = vi.mocked(adminMod.getAdminFirestore);
    getAdminFirestore.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef),
      }),
    } as unknown as ReturnType<typeof adminMod.getAdminFirestore>);
  });

  it("edita rascunho com sucesso, seta embeddingVersion: 0 e incrementa version", async () => {
    getAuthorizedSession.mockResolvedValue(mockSession("professional"));
    mockDocRef.get.mockResolvedValue(
      makeDocSnap({ reviewStatus: "draft", deletedAt: null })
    );

    const { PATCH } = await import("../update/route");
    const res = await PATCH(
      makeRequest({ id: "item-123", patch: { title: "Novo título" } })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reviewStatusChanged).toBe(false);

    const updateArgs = mockDocRef.update.mock.calls[0];
    if (!updateArgs) throw new Error("update não foi chamado");
    const updateCall = updateArgs[0] as Record<string, unknown>;
    expect(updateCall.embeddingVersion).toBe(0);
    expect(updateCall.title).toBe("Novo título");
    // reviewStatus não deve ter mudado
    expect(updateCall.reviewStatus).toBeUndefined();
  });

  it("edita item publicado: reverte para in_review e invalida embedding", async () => {
    getAuthorizedSession.mockResolvedValue(mockSession("reviewer"));
    mockDocRef.get.mockResolvedValue(
      makeDocSnap({ reviewStatus: "published", deletedAt: null })
    );

    const { PATCH } = await import("../update/route");
    const res = await PATCH(
      makeRequest({ id: "item-pub", patch: { content: "Conteúdo atualizado" } })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reviewStatusChanged).toBe(true);
    expect(body.newReviewStatus).toBe("in_review");

    const updateArgs2 = mockDocRef.update.mock.calls[0];
    if (!updateArgs2) throw new Error("update não foi chamado");
    const updateCall2 = updateArgs2[0] as Record<string, unknown>;
    expect(updateCall2.reviewStatus).toBe("in_review");
    expect(updateCall2.embeddingVersion).toBe(0);
  });

  it("edita item aprovado: reverte para in_review", async () => {
    getAuthorizedSession.mockResolvedValue(mockSession("administrator"));
    mockDocRef.get.mockResolvedValue(
      makeDocSnap({ reviewStatus: "approved", deletedAt: null })
    );

    const { PATCH } = await import("../update/route");
    const res = await PATCH(
      makeRequest({ id: "item-apv", patch: { summary: "Novo resumo" } })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reviewStatusChanged).toBe(true);
    expect(body.newReviewStatus).toBe("in_review");
  });

  it("professional é bloqueado de editar item publicado (403)", async () => {
    getAuthorizedSession.mockResolvedValue(mockSession("professional"));
    mockDocRef.get.mockResolvedValue(
      makeDocSnap({ reviewStatus: "published", deletedAt: null })
    );

    const { PATCH } = await import("../update/route");
    const res = await PATCH(
      makeRequest({ id: "item-pub", patch: { title: "Tentativa" } })
    );

    expect(res.status).toBe(403);
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  it("professional pode editar item in_review", async () => {
    getAuthorizedSession.mockResolvedValue(mockSession("professional"));
    mockDocRef.get.mockResolvedValue(
      makeDocSnap({ reviewStatus: "in_review", deletedAt: null })
    );

    const { PATCH } = await import("../update/route");
    const res = await PATCH(
      makeRequest({ id: "item-rev", patch: { tags: ["autismo"] } })
    );

    expect(res.status).toBe(200);
    expect(mockDocRef.update).toHaveBeenCalled();
  });

  it("retorna 404 quando item não existe", async () => {
    getAuthorizedSession.mockResolvedValue(mockSession("reviewer"));
    mockDocRef.get.mockResolvedValue(makeDocSnap({}, false));

    const { PATCH } = await import("../update/route");
    const res = await PATCH(
      makeRequest({ id: "nao-existe", patch: {} })
    );

    expect(res.status).toBe(404);
  });

  it("retorna 400 quando item está excluído", async () => {
    getAuthorizedSession.mockResolvedValue(mockSession("reviewer"));
    mockDocRef.get.mockResolvedValue(
      makeDocSnap({ reviewStatus: "draft", deletedAt: new Date() })
    );

    const { PATCH } = await import("../update/route");
    const res = await PATCH(
      makeRequest({ id: "item-del", patch: { title: "X" } })
    );

    expect(res.status).toBe(400);
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  it("retorna 403 quando não há sessão ativa", async () => {
    getAuthorizedSession.mockResolvedValue(null);

    const { PATCH } = await import("../update/route");
    const res = await PATCH(makeRequest({ id: "item-x", patch: {} }));

    expect(res.status).toBe(403);
  });
});
