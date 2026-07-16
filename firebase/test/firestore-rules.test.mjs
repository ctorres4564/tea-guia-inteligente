/**
 * Testes de Regras do Firebase Emulator — Firestore
 *
 * PRÉ-REQUISITO: Firebase Emulator deve estar ativo antes de rodar este arquivo.
 *   npm run firebase:emulators
 *
 * Como executar:
 *   node firebase/test/firestore-rules.test.mjs
 *
 * O que é testado:
 *   - Criação de rascunho válida (deve ser permitida)
 *   - Criação com campos administrativos manipulados (deve ser bloqueada)
 *   - Criação com publishedAt/reviewedBy (deve ser bloqueada)
 *   - Edição de rascunho por editor (deve ser permitida)
 *   - Edição de conteúdo publicado por professional (deve ser bloqueada)
 *   - Tentativa de gravar embeddingVersion pelo cliente (deve ser bloqueada)
 *   - Conta inativa não pode criar/editar (deve ser bloqueada)
 *   - Isolamento entre usuários em favoritos/histórico
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setDoc, doc, updateDoc, getDoc } from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rulesPath = join(__dirname, "../../firebase/firestore.rules");

const PROJECT_ID = "tea-guia-test";
let testEnv;

async function setupTestEnv() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "localhost",
      port: 8080,
      rules: readFileSync(rulesPath, "utf8"),
    },
  });
}

async function teardown() {
  await testEnv?.cleanup();
}

// ---------- Helpers ----------

function activeProfile(uid, role = "professional") {
  return testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `profiles/${uid}`), {
      uid,
      role,
      status: "active",
      email: `${uid}@test.com`,
      displayName: "Test User",
    });
  });
}

function inactiveProfile(uid, role = "professional") {
  return testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `profiles/${uid}`), {
      uid,
      role,
      status: "blocked",
      email: `${uid}@test.com`,
      displayName: "Blocked User",
    });
  });
}

function draftItem(id, createdBy) {
  return {
    title: "Teste",
    slug: "teste",
    summary: "Resumo",
    content: "Conteúdo",
    categoryId: "cat-1",
    reviewStatus: "draft",
    deletedAt: null,
    createdBy,
    version: 1,
    targetAudience: ["family"],
    tags: [],
    attachments: [],
  };
}

// ---------- Runner simples ----------

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ---------- Suítes ----------

async function testKnowledgeItemCreation() {
  console.log("\n📋 Criação de knowledgeItems");

  const uid = "prof-create";
  await activeProfile(uid, "professional");
  const profCtx = testEnv.authenticatedContext(uid);

  await test("rascunho válido é criado com sucesso", async () => {
    await assertSucceeds(
      setDoc(doc(profCtx.firestore(), `knowledgeItems/item-ok`), draftItem("item-ok", uid))
    );
  });

  await test("rejeita criação com publishedAt no payload", async () => {
    await assertFails(
      setDoc(doc(profCtx.firestore(), `knowledgeItems/item-bad1`), {
        ...draftItem("item-bad1", uid),
        publishedAt: new Date(),
      })
    );
  });

  await test("rejeita criação com embeddingVersion no payload", async () => {
    await assertFails(
      setDoc(doc(profCtx.firestore(), `knowledgeItems/item-bad2`), {
        ...draftItem("item-bad2", uid),
        embeddingVersion: 1,
      })
    );
  });

  await test("rejeita criação com status != draft", async () => {
    await assertFails(
      setDoc(doc(profCtx.firestore(), `knowledgeItems/item-bad3`), {
        ...draftItem("item-bad3", uid),
        reviewStatus: "published",
      })
    );
  });

  const inactiveUid = "inactive-user";
  await inactiveProfile(inactiveUid, "professional");
  const inactiveCtx = testEnv.authenticatedContext(inactiveUid);

  await test("conta inativa não pode criar conteúdo", async () => {
    await assertFails(
      setDoc(
        doc(inactiveCtx.firestore(), `knowledgeItems/item-inactive`),
        draftItem("item-inactive", inactiveUid)
      )
    );
  });
}

async function testKnowledgeItemEditing() {
  console.log("\n✏️  Edição de knowledgeItems");

  const profUid = "prof-edit";
  const reviewerUid = "reviewer-edit";
  await activeProfile(profUid, "professional");
  await activeProfile(reviewerUid, "reviewer");

  // Seed: rascunho e item publicado
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "knowledgeItems/draft-item"), {
      ...draftItem("draft-item", profUid),
    });
    await setDoc(doc(ctx.firestore(), "knowledgeItems/pub-item"), {
      ...draftItem("pub-item", profUid),
      reviewStatus: "published",
    });
  });

  const profCtx = testEnv.authenticatedContext(profUid);
  const reviewerCtx = testEnv.authenticatedContext(reviewerUid);

  await test("professional pode editar rascunho (campos de conteúdo)", async () => {
    await assertSucceeds(
      updateDoc(doc(profCtx.firestore(), "knowledgeItems/draft-item"), {
        title: "Título atualizado",
        updatedAt: new Date(),
      })
    );
  });

  await test("professional não pode alterar embeddingVersion diretamente", async () => {
    await assertFails(
      updateDoc(doc(profCtx.firestore(), "knowledgeItems/draft-item"), {
        embeddingVersion: 1,
      })
    );
  });

  await test("professional não pode alterar publishedAt diretamente", async () => {
    await assertFails(
      updateDoc(doc(profCtx.firestore(), "knowledgeItems/draft-item"), {
        publishedAt: new Date(),
      })
    );
  });

  await test("professional não pode editar item publicado", async () => {
    await assertFails(
      updateDoc(doc(profCtx.firestore(), "knowledgeItems/pub-item"), {
        title: "Tentativa indevida",
      })
    );
  });

  await test("reviewer pode editar item publicado (força in_review via API)", async () => {
    // Regra: reviewer pode editar qualquer status
    await assertSucceeds(
      updateDoc(doc(reviewerCtx.firestore(), "knowledgeItems/pub-item"), {
        title: "Correção editorial",
        updatedAt: new Date(),
      })
    );
  });

  await test("ninguém pode alterar createdBy", async () => {
    await assertFails(
      updateDoc(doc(profCtx.firestore(), "knowledgeItems/draft-item"), {
        createdBy: "atacante",
      })
    );
  });
}

async function testFavoritesIsolation() {
  console.log("\n⭐ Favoritos — Isolamento entre usuários");

  const userA = "fav-user-a";
  const userB = "fav-user-b";
  await activeProfile(userA);
  await activeProfile(userB);

  const ctxA = testEnv.authenticatedContext(userA);
  const ctxB = testEnv.authenticatedContext(userB);

  await test("usuário A cria seu próprio favorito (deve ser permitido)", async () => {
    await assertSucceeds(
      setDoc(doc(ctxA.firestore(), `favorites/${userA}/items/fav-1`), {
        knowledgeItemId: "item-123",
        createdAt: new Date(),
      })
    );
  });

  await test("usuário B não pode criar favorito para usuário A", async () => {
    await assertFails(
      setDoc(doc(ctxB.firestore(), `favorites/${userA}/items/fav-bad`), {
        knowledgeItemId: "item-xyz",
        createdAt: new Date(),
      })
    );
  });

  await test("usuário B não pode ler favoritos do usuário A", async () => {
    await assertFails(
      getDoc(doc(ctxB.firestore(), `favorites/${userA}/items/fav-1`))
    );
  });

  await test("campos extras em favoritos são rejeitados", async () => {
    await assertFails(
      setDoc(doc(ctxA.firestore(), `favorites/${userA}/items/fav-bad2`), {
        knowledgeItemId: "item-abc",
        createdAt: new Date(),
        campoExtra: "não permitido",
      })
    );
  });
}

// ---------- Main ----------

async function main() {
  console.log("🔥 Firebase Firestore Rules Tests");
  console.log("   Emulador: localhost:8080\n");

  try {
    await setupTestEnv();
    await testEnv.clearFirestore();

    await testKnowledgeItemCreation();
    await testKnowledgeItemEditing();
    await testFavoritesIsolation();

    console.log(`\n${"─".repeat(50)}`);
    console.log(`✅ ${passed} passando  |  ❌ ${failed} falhando`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("\n❌ Erro ao inicializar o ambiente de testes:", err.message);
    console.error("   Verifique se o Firebase Emulator está rodando:");
    console.error("   npm run firebase:emulators");
    process.exit(1);
  } finally {
    await teardown();
  }
}

main();
