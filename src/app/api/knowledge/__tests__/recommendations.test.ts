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

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/knowledge/recommendations", {
    method: "GET",
  });
}

describe("GET /api/knowledge/recommendations", () => {
  let getActiveSession: ReturnType<typeof vi.fn>;
  let mockGetChildren: ReturnType<typeof vi.fn>;
  let mockGetItems: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const authMod = await import("@/lib/security/authorization");
    getActiveSession = vi.mocked(authMod.getActiveSession);
    getActiveSession.mockResolvedValue({
      sessionUser: { uid: "user-123" },
      profile: { role: "family", status: "active" },
    });

    mockGetChildren = vi.fn();
    mockGetItems = vi.fn();

    const adminMod = await import("@/lib/firebase/admin");
    vi.mocked(adminMod.getAdminFirestore).mockReturnValue({
      collection: vi.fn().mockImplementation((col) => {
        if (col === "children") {
          return {
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                get: mockGetChildren,
              }),
            }),
          };
        }
        // Para knowledgeItems
        return {
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          findNearest: vi.fn().mockReturnValue({
            get: mockGetItems,
          }),
          get: mockGetItems,
        };
      }),
    } as any);
  });

  it("retorna novidades gerais se nao houver criancas cadastradas", async () => {
    mockGetChildren.mockResolvedValue({
      empty: true,
      docs: [],
    });

    mockGetItems.mockResolvedValue({
      docs: [
        {
          id: "recent-1",
          data: () => ({
            id: "recent-1",
            categoryId: "cat-1",
            title: "Novidade 1",
            slug: "novidade-1",
            summary: "Resumo",
            content: "Conteúdo",
            evidenceLevel: "moderate",
            targetAudience: ["family"],
            reviewStatus: "published",
            version: 1,
            createdBy: "prof-1",
            tags: [],
            attachments: [],
            publishedAt: { seconds: 1700000000 },
          }),
        },
      ],
    });

    const { GET } = await import("../recommendations/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hasProfile).toBe(false);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].title).toBe("Novidade 1");
  });

  it("retorna recomendacoes baseadas no perfil da crianca com sucesso", async () => {
    mockGetChildren.mockResolvedValue({
      empty: false,
      docs: [
        {
          id: "child-1",
          data: () => ({
            name: "Lucas",
            birthDate: "2022-05-15",
            interests: ["dinossauro", "blocos"],
            sensitivities: ["barulho"],
            supportLevel: "level_1",
          }),
        },
      ],
    });

    mockGetItems.mockResolvedValue({
      docs: [
        {
          id: "item-rec",
          data: () => ({
            id: "item-rec",
            categoryId: "cat-1",
            title: "Estimulando Lucas com Dinossauros",
            slug: "estimulando-lucas",
            summary: "Artigo sobre interesses específicos no autismo.",
            content: "Artigo clínico completo.",
            evidenceLevel: "high",
            targetAudience: ["family"],
            reviewStatus: "published",
            version: 1,
            createdBy: "prof-1",
            tags: ["dinossauro"],
            attachments: [],
            searchDistance: 0.1, // similarity = 0.9
            ageRange: "2-5 anos",
          }),
        },
      ],
    });

    const { GET } = await import("../recommendations/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hasProfile).toBe(true);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].title).toContain("Lucas");
  });
});
