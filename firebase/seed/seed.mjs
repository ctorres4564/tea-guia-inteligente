/**
 * Script de seed — popula categorias e conteúdos de exemplo APENAS no
 * Firestore Emulator, para testes manuais e automatizados locais.
 *
 * Segurança: este script força o uso dos emuladores (via
 * FIRESTORE_EMULATOR_HOST) antes de inicializar o Admin SDK, e usa um
 * project ID de demonstração — nunca escreve em um projeto Firebase real,
 * mesmo que credenciais de produção estejam presentes no ambiente.
 *
 * Uso:
 *   1. Em um terminal: npm run firebase:emulators
 *   2. Em outro terminal: npm run firebase:seed
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";

const { initializeApp, cert: _cert, applicationDefault: _applicationDefault } = await import(
  "firebase-admin/app"
);
const { getFirestore, FieldValue } = await import("firebase-admin/firestore");

const DEMO_PROJECT_ID = "demo-tea-guia-inteligente";

const app = initializeApp({ projectId: DEMO_PROJECT_ID });
const db = getFirestore(app);

const SEED_AUTHOR_UID = "seed-script";

const categories = [
  { name: "Comunicação", slug: "comunicacao", description: "Fala, linguagem, ecolalia, CAA e PECS.", displayOrder: 0 },
  { name: "Comportamento", slug: "comportamento", description: "Crises, rigidez e autorregulação.", displayOrder: 1 },
  { name: "Alimentação", slug: "alimentacao", description: "Seletividade alimentar e rotina de refeições.", displayOrder: 2 },
  { name: "Sono", slug: "sono", description: "Rotina de sono e despertares noturnos.", displayOrder: 3 },
  { name: "Escola", slug: "escola", description: "Inclusão escolar e adaptações pedagógicas.", displayOrder: 4 },
];

const knowledgeItemsByCategorySlug = {
  comunicacao: [
    {
      title: "O que é ecolalia?",
      slug: "o-que-e-ecolalia",
      summary: "Ecolalia é a repetição de palavras ou frases ouvidas anteriormente. Veja o que fazer.",
      content:
        "Ecolalia é uma forma comum de comunicação em crianças autistas, que pode ser imediata ou tardia. " +
        "Não deve ser interpretada isoladamente como um problema — muitas vezes é uma estratégia de comunicação " +
        "funcional. Este conteúdo é um exemplo de seed e deve ser revisado por um especialista antes de publicação real.",
      targetAudience: ["family", "educator"],
      ageRange: "2 a 6 anos",
      tags: ["ecolalia", "linguagem", "comunicação"],
      evidenceLevel: "moderate",
    },
  ],
  comportamento: [
    {
      title: "Como agir durante uma crise?",
      slug: "como-agir-durante-uma-crise",
      summary: "Orientações práticas e objetivas para o momento de uma crise comportamental.",
      content:
        "Manter a calma, garantir a segurança da criança e do ambiente, reduzir estímulos e evitar longas " +
        "explicações verbais durante a crise são estratégias frequentemente recomendadas. Este conteúdo é um " +
        "exemplo de seed e deve ser revisado por um especialista antes de publicação real.",
      targetAudience: ["family", "educator", "professional"],
      ageRange: "Todas as idades",
      tags: ["crise", "comportamento", "autorregulação"],
      evidenceLevel: "expert_consensus",
    },
  ],
};

async function upsertCategory(category) {
  const existing = await db.collection("categories").where("slug", "==", category.slug).limit(1).get();
  if (!existing.empty) {
    return existing.docs[0];
  }

  const ref = await db.collection("categories").add({
    ...category,
    parentId: null,
    status: "published",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.get();
}

async function upsertKnowledgeItem(categoryId, item) {
  const existing = await db.collection("knowledgeItems").where("slug", "==", item.slug).limit(1).get();
  if (!existing.empty) return;

  const mockVector = new Array(768).fill(0).map(() => Math.random() * 0.1);

  await db.collection("knowledgeItems").add({
    ...item,
    categoryId,
    tags: item.tags ?? [],
    reviewStatus: "published",
    version: 1,
    publishedAt: FieldValue.serverTimestamp(),
    createdBy: SEED_AUTHOR_UID,
    reviewedBy: SEED_AUTHOR_UID,
    deletedAt: null,
    attachments: [],
    embedding: FieldValue.vector(mockVector),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function main() {
  console.log(`Conectando ao Firestore Emulator em ${process.env.FIRESTORE_EMULATOR_HOST}...`);

  const categoryDocsBySlug = {};
  for (const category of categories) {
    const doc = await upsertCategory(category);
    categoryDocsBySlug[category.slug] = doc.id;
    console.log(`Categoria pronta: ${category.name} (${doc.id})`);
  }

  for (const [slug, items] of Object.entries(knowledgeItemsByCategorySlug)) {
    const categoryId = categoryDocsBySlug[slug];
    for (const item of items) {
      await upsertKnowledgeItem(categoryId, item);
      console.log(`Conteúdo pronto: ${item.title}`);
    }
  }

  console.log("Seed concluído com sucesso.");
}

main().catch((error) => {
  console.error("Falha ao executar o seed:", error);
  process.exit(1);
});
