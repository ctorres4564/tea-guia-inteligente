/**
 * Testes unitários para /api/admin/knowledge/publish/route.ts
 *
 * Verifica que a rota rejeita itens em status diferentes de "approved"
 * e que o fluxo editorial não pode ser burlado via chamada direta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------- Mocks ----------

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: vi.fn(),
}));

vi.mock("@/lib/security/authorization", () => ({
  getAuthorizedSession: vi.fn(),
  REVIEWER_ROLES: ["reviewer", "administrator"],
}));

vi.mock("@/lib/errors/firebase-errors", () => ({
  mapFirebaseError: (e: unknown) => ({
    message: e instanceof Error ? e.message : "Erro desconhecido",
  }),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      embedContent: vi.fn().mockResolvedValue({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      }),
    },
  })),
}));

// ---------- Helpers ----------

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/admin/knowledge/publish", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDocSnap(data: Record<string, unknown>, exists = true) {
  return {
    exists: exists,
    data: () => data,
  };
}

// ---------- Testes ----------

describe("POST /api/admin/knowledge/publish — fluxo editorial", () => {
  let getAuthorizedSession: ReturnType<typeof vi.fn>;
  let mockDocRef: { get: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = "true"; // usa mock embedding

    const authMod = await import("@/lib/security/authorization");
    getAuthorizedSession = vi.mocked(authMod.getAuthorizedSession);
    getAuthorizedSession.mockResolvedValue({
      sessionUser: { uid: "reviewer-uid-123" },
      profile: { role: "reviewer", status: "active" },
    });

    mockDocRef = {
      get: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    };

    const adminMod = await import("@/lib/firebase/admin");
    vi.mocked(adminMod.getAdminFirestore).mockReturnValue({
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef),
        add: vi.fn().mockResolvedValue({ id: "notif-id-123" }),
      }),
    } as unknown as ReturnType<typeof adminMod.getAdminFirestore>);
  });

  it("publica item com status 'approved' com sucesso", async () => {
    mockDocRef.get.mockResolvedValue(
      makeDocSnap({
        reviewStatus: "approved",
        deletedAt: null,
        title: "Título",
        summary: "Resumo",
        content: "Conteúdo",
        tags: ["tag1"],
      })
    );

    const { POST } = await import("../publish/route");
    const res = await POST(makeRequest({ id: "item-123" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: "published",
        embeddingVersion: 1,
      })
    );
  });

  it("rejeita publicação de item com status 'draft' com 409", async () => {
    mockDocRef.get.mockResolvedValue(
      makeDocSnap({ reviewStatus: "draft", deletedAt: null })
    );

    const { POST } = await import("../publish/route");
    const res = await POST(makeRequest({ id: "item-abc" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("draft");
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  it("rejeita publicação de item com status 'in_review' com 409", async () => {
    mockDocRef.get.mockResolvedValue(
      makeDocSnap({ reviewStatus: "in_review", deletedAt: null })
    );

    const { POST } = await import("../publish/route");
    const res = await POST(makeRequest({ id: "item-def" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain("in_review");
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  it("rejeita publicação de item com status 'rejected' com 409", async () => {
    mockDocRef.get.mockResolvedValue(
      makeDocSnap({ reviewStatus: "rejected", deletedAt: null })
    );

    const { POST } = await import("../publish/route");
    const res = await POST(makeRequest({ id: "item-ghi" }));

    expect(res.status).toBe(409);
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  it("rejeita publicação de item excluído com 400", async () => {
    mockDocRef.get.mockResolvedValue(
      makeDocSnap({ reviewStatus: "approved", deletedAt: new Date() })
    );

    const { POST } = await import("../publish/route");
    const res = await POST(makeRequest({ id: "item-del" }));

    expect(res.status).toBe(400);
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  it("retorna 403 quando usuário não tem papel de revisor", async () => {
    getAuthorizedSession.mockResolvedValue(null);

    const { POST } = await import("../publish/route");
    const res = await POST(makeRequest({ id: "item-123" }));

    expect(res.status).toBe(403);
  });

  it("retorna 400 quando o ID não é enviado", async () => {
    const { POST } = await import("../publish/route");
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
  });
});
