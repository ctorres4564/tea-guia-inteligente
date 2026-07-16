import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------- Mocks ----------

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: vi.fn(),
}));

vi.mock("@/lib/security/authorization", () => ({
  getActiveSession: vi.fn(),
}));

vi.mock("@/lib/errors/firebase-errors", () => ({
  mapFirebaseError: (e: unknown) => ({
    message: e instanceof Error ? e.message : "Erro desconhecido",
  }),
}));

// ---------- Helpers ----------

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/knowledge/related", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDocSnap(data: Record<string, unknown>, exists = true) {
  return {
    exists,
    data: () => data,
  };
}

describe("POST /api/knowledge/related", () => {
  let getActiveSession: ReturnType<typeof vi.fn>;
  let mockDocRef: { get: ReturnType<typeof vi.fn> };
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const authMod = await import("@/lib/security/authorization");
    getActiveSession = vi.mocked(authMod.getActiveSession);
    getActiveSession.mockResolvedValue({
      sessionUser: { uid: "user-123" },
      profile: { role: "family", status: "active" },
    });

    mockDocRef = {
      get: vi.fn(),
    };

    mockGet = vi.fn();

    const adminMod = await import("@/lib/firebase/admin");
    vi.mocked(adminMod.getAdminFirestore).mockReturnValue({
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        findNearest: vi.fn().mockReturnValue({
          get: mockGet,
        }),
        get: mockGet,
      }),
    } as any);
  });

  it("retorna erro 400 se itemId não for enviado", async () => {
    const { POST } = await import("../related/route");
    const res = await POST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("itemId' é obrigatório");
  });

  it("retorna erro 404 se item de referência não existir", async () => {
    mockDocRef.get.mockResolvedValue(makeDocSnap({}, false));

    const { POST } = await import("../related/route");
    const res = await POST(makeRequest({ itemId: "id-invalido" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain("não encontrado");
  });

  it("retorna relacionados via KNN semântico com sucesso", async () => {
    mockDocRef.get.mockResolvedValue(
      makeDocSnap({
        title: "Artigo Base",
        embedding: new Array(768).fill(0.1),
      })
    );

    mockGet.mockResolvedValue({
      docs: [
        {
          id: "item-rel-1",
          data: () => ({
            id: "item-rel-1",
            categoryId: "cat-1",
            title: "Artigo Relacionado 1",
            slug: "artigo-relacionado-1",
            summary: "Resumo",
            content: "Conteúdo",
            evidenceLevel: "high",
            targetAudience: ["family"],
            reviewStatus: "published",
            version: 1,
            createdBy: "prof-1",
            tags: [],
            attachments: [],
            searchDistance: 0.1, // similarity = 0.9
          }),
        },
      ],
    });

    const { POST } = await import("../related/route");
    const res = await POST(makeRequest({ itemId: "item-123" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].title).toBe("Artigo Relacionado 1");
    expect(body.results[0].similarity).toBeCloseTo(0.9);
  });
});
