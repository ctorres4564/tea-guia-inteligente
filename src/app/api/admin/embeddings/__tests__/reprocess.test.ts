import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------- Mocks ----------

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: vi.fn(),
}));

vi.mock("@/lib/security/authorization", () => ({
  getAuthorizedSession: vi.fn(),
}));

vi.mock("@/lib/errors/firebase-errors", () => ({
  mapFirebaseError: (e: unknown) => ({
    message: e instanceof Error ? e.message : "Erro desconhecido",
  }),
}));

// ---------- Helpers ----------

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/admin/embeddings/reprocess", {
    method: "POST",
  });
}

describe("POST /api/admin/embeddings/reprocess", () => {
  let getAuthorizedSession: ReturnType<typeof vi.fn>;
  let mockGetPending: ReturnType<typeof vi.fn>;
  let mockUpdateDoc: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = "true";

    const authMod = await import("@/lib/security/authorization");
    getAuthorizedSession = vi.mocked(authMod.getAuthorizedSession);
    getAuthorizedSession.mockResolvedValue({
      sessionUser: { uid: "admin-uid" },
      profile: { role: "administrator", status: "active" },
    });

    mockGetPending = vi.fn();
    mockUpdateDoc = vi.fn().mockResolvedValue(undefined);

    const adminMod = await import("@/lib/firebase/admin");
    vi.mocked(adminMod.getAdminFirestore).mockReturnValue({
      collection: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: mockGetPending,
        doc: vi.fn().mockReturnValue({
          update: mockUpdateDoc,
        }),
      }),
    } as any);
  });

  it("retorna erro 403 se o usuario nao for administrador", async () => {
    getAuthorizedSession.mockResolvedValue(null); // Acesso negado

    const { POST } = await import("../reprocess/route");
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain("Acesso negado");
  });

  it("retorna processedCount: 0 se nao houver itens pendentes", async () => {
    mockGetPending.mockResolvedValue({
      empty: true,
      docs: [],
    });

    const { POST } = await import("../reprocess/route");
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processedCount).toBe(0);
  });

  it("reprocessa itens pendentes com sucesso", async () => {
    mockGetPending.mockResolvedValue({
      empty: false,
      docs: [
        {
          id: "item-pend-1",
          data: () => ({
            title: "Artigo pendente",
            summary: "Resumo",
            content: "Conteúdo",
            tags: ["tag1"],
          }),
        },
      ],
    });

    const { POST } = await import("../reprocess/route");
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processedCount).toBe(1);
    expect(mockUpdateDoc).toHaveBeenCalled();
  });
});
