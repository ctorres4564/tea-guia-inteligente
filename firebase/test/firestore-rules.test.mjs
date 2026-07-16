/**
 * Testes de Regras do Firebase Emulator — Firestore
 *
 * PRÉ-REQUISITO: Firebase Emulator deve estar ativo antes de rodar este arquivo.
 *   npm run firebase:emulators
 *
 * Como executar:
 *   npm run test:rules
 *
 * Cenários cobertos:
 *   - Criação de rascunho válida
 *   - Criação com campos administrativos bloqueados
 *   - Edição de rascunho por professional
 *   - Bloqueio de edição de publicado por professional
 *   - Reviewer pode editar publicado
 *   - embeddingVersion/publishedAt imutáveis pelo cliente
 *   - createdBy imutável
 *   - Conta inativa/bloqueada bloqueada
 *   - Isolamento de favoritos entre usuários
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
    console.error(`    ${err.message?.split("\n")[0] ?? err}`);
    failed++;
  }
}

// ---------- Dados de seed ----------

const PROF_UID = "prof-main";
const INACTIVE_UID = "inactive-main";
const REVIEWER_UID = "reviewer-main";
const USER_A_UID = "user-a";
const USER_B_UID = "user-b";

function draftItemData(id, createdBy) {
  return {
    title: "Teste",
    slug: `teste-${id}`,
    summary: "Resumo",
    content: "Conteúdo clínico",
    categoryId: "cat-1",
    reviewStatus: "draft",
    deletedAt: null,
    createdBy,
    version: 1,
    targetAudience: ["family"],
    tags: [],
    evidenceLevel: "moderate",
    ageRange: "",
    attachments: [],
  };
}

// ---------- Main ----------

async function main() {
  console.log("🔥 Firebase Firestore Rules Tests");
  console.log("   Emulador: localhost:8080\n");

  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: "localhost",
        port: 8080,
        rules: readFileSync(rulesPath, "utf8"),
      },
    });

    // Limpa o estado anterior
    await testEnv.clearFirestore();

    // -------------------------------------------------------
    // Seed único: todos os perfis e itens base em uma
    // única chamada withSecurityRulesDisabled.
    // Recomendado pelo @firebase/rules-unit-testing para
    // evitar conflitos de inicialização do SDK Firestore.
    // -------------------------------------------------------
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();

      // Perfis
      await setDoc(doc(db, `profiles/${PROF_UID}`), {
        uid: PROF_UID, role: "professional", status: "active",
        email: "prof@test.com", displayName: "Prof",
      });
      await setDoc(doc(db, `profiles/${INACTIVE_UID}`), {
        uid: INACTIVE_UID, role: "professional", status: "blocked",
        email: "inactive@test.com", displayName: "Inactive",
      });
      await setDoc(doc(db, `profiles/${REVIEWER_UID}`), {
        uid: REVIEWER_UID, role: "reviewer", status: "active",
        email: "reviewer@test.com", displayName: "Reviewer",
      });
      await setDoc(doc(db, `profiles/${USER_A_UID}`), {
        uid: USER_A_UID, role: "professional", status: "active",
        email: "a@test.com", displayName: "User A",
      });
      await setDoc(doc(db, `profiles/${USER_B_UID}`), {
        uid: USER_B_UID, role: "professional", status: "active",
        email: "b@test.com", displayName: "User B",
      });

      // Itens base para os testes de edição
      await setDoc(doc(db, "knowledgeItems/draft-base"), {
        ...draftItemData("draft-base", PROF_UID),
      });
      await setDoc(doc(db, "knowledgeItems/published-base"), {
        ...draftItemData("published-base", PROF_UID),
        reviewStatus: "published",
      });
    });

    // Obtém DB references UMA ÚNICA VEZ por usuário
    // (chamar .firestore() múltiplas vezes causa "already started")
    const profDb = testEnv.authenticatedContext(PROF_UID).firestore();
    const inactiveDb = testEnv.authenticatedContext(INACTIVE_UID).firestore();
    const reviewerDb = testEnv.authenticatedContext(REVIEWER_UID).firestore();
    const userADb = testEnv.authenticatedContext(USER_A_UID).firestore();
    const userBDb = testEnv.authenticatedContext(USER_B_UID).firestore();
    const anonDb = testEnv.unauthenticatedContext().firestore();

    // =====================================================
    // Suíte 1: Criação de knowledgeItems
    // =====================================================
    console.log("📋 Criação de knowledgeItems");

    await test("rascunho válido é criado com sucesso", async () => {
      await assertSucceeds(
        setDoc(doc(profDb, "knowledgeItems/item-new-ok"), draftItemData("item-new-ok", PROF_UID))
      );
    });

    await test("rejeita criação com publishedAt no payload", async () => {
      await assertFails(
        setDoc(doc(profDb, "knowledgeItems/item-bad-pub"), {
          ...draftItemData("item-bad-pub", PROF_UID),
          publishedAt: new Date(),
        })
      );
    });

    await test("rejeita criação com embeddingVersion no payload", async () => {
      await assertFails(
        setDoc(doc(profDb, "knowledgeItems/item-bad-emb"), {
          ...draftItemData("item-bad-emb", PROF_UID),
          embeddingVersion: 1,
        })
      );
    });

    await test("rejeita criação com reviewStatus != draft", async () => {
      await assertFails(
        setDoc(doc(profDb, "knowledgeItems/item-bad-status"), {
          ...draftItemData("item-bad-status", PROF_UID),
          reviewStatus: "published",
        })
      );
    });

    await test("conta inativa/bloqueada não pode criar conteúdo", async () => {
      await assertFails(
        setDoc(doc(inactiveDb, "knowledgeItems/item-inactive"), draftItemData("item-inactive", INACTIVE_UID))
      );
    });

    // =====================================================
    // Suíte 2: Edição de knowledgeItems
    // =====================================================
    console.log("\n✏️  Edição de knowledgeItems");

    await test("professional pode editar campos de rascunho", async () => {
      await assertSucceeds(
        updateDoc(doc(profDb, "knowledgeItems/draft-base"), {
          title: "Título atualizado",
        })
      );
    });

    await test("professional não pode alterar embeddingVersion diretamente", async () => {
      await assertFails(
        updateDoc(doc(profDb, "knowledgeItems/draft-base"), {
          embeddingVersion: 1,
        })
      );
    });

    await test("professional não pode alterar publishedAt diretamente", async () => {
      await assertFails(
        updateDoc(doc(profDb, "knowledgeItems/draft-base"), {
          publishedAt: new Date(),
        })
      );
    });

    await test("professional não pode editar item publicado", async () => {
      await assertFails(
        updateDoc(doc(profDb, "knowledgeItems/published-base"), {
          title: "Tentativa indevida",
        })
      );
    });

    await test("reviewer pode editar item publicado", async () => {
      await assertSucceeds(
        updateDoc(doc(reviewerDb, "knowledgeItems/published-base"), {
          title: "Correção editorial pelo revisor",
        })
      );
    });

    await test("ninguém pode alterar createdBy", async () => {
      await assertFails(
        updateDoc(doc(profDb, "knowledgeItems/draft-base"), {
          createdBy: "atacante-uid",
        })
      );
    });

    await test("professional não pode alterar reviewedBy", async () => {
      await assertFails(
        updateDoc(doc(profDb, "knowledgeItems/draft-base"), {
          reviewedBy: "auto-aprovacao",
        })
      );
    });

    // =====================================================
    // Suíte 3: Favoritos — Isolamento entre usuários
    // =====================================================
    console.log("\n⭐ Favoritos — Isolamento entre usuários");

    await test("usuário A cria seu próprio favorito", async () => {
      await assertSucceeds(
        setDoc(doc(userADb, `favorites/${USER_A_UID}/items/fav-1`), {
          knowledgeItemId: "item-123",
          createdAt: new Date(),
        })
      );
    });

    await test("usuário B não pode criar favorito para usuário A", async () => {
      await assertFails(
        setDoc(doc(userBDb, `favorites/${USER_A_UID}/items/fav-invasao`), {
          knowledgeItemId: "item-xyz",
          createdAt: new Date(),
        })
      );
    });

    await test("usuário B não pode ler favoritos do usuário A", async () => {
      await assertFails(
        getDoc(doc(userBDb, `favorites/${USER_A_UID}/items/fav-1`))
      );
    });

    // =====================================================
    // Suíte 4: Histórico — Isolamento entre usuários
    // =====================================================
    console.log("\n📜 Histórico — Isolamento entre usuários");

    await test("usuário A cria seu próprio histórico", async () => {
      await assertSucceeds(
        setDoc(doc(userADb, `history/${USER_A_UID}/items/hist-1`), {
          type: "search",
          query: "autismo",
          knowledgeItemId: null,
          createdAt: new Date(),
        })
      );
    });

    await test("usuário B não pode criar histórico para usuário A", async () => {
      await assertFails(
        setDoc(doc(userBDb, `history/${USER_A_UID}/items/hist-invasao`), {
          type: "view",
          createdAt: new Date(),
        })
      );
    });

    await test("histórico com estrutura inválida é rejeitado (sem createdAt)", async () => {
      await assertFails(
        setDoc(doc(userADb, `history/${USER_A_UID}/items/hist-bad`), {
          type: "search",
          query: "teste",
          // createdAt ausente — regra exige timestamp
        })
      );
    });

    // =====================================================================
    // Suíte 5: Notificações de Sistema
    // =====================================================================
    console.log("\n🔔 Notificações — Acesso público-ativo e escrita bloqueada");

    await test("usuário ativo pode ler notificações do sistema", async () => {
      await assertSucceeds(
        getDoc(doc(userADb, "notifications/notif-123"))
      );
    });

    await test("usuário anônimo não pode ler notificações", async () => {
      await assertFails(
        getDoc(doc(anonDb, "notifications/notif-123"))
      );
    });

    await test("nenhum usuário cliente pode criar notificações", async () => {
      await assertFails(
        setDoc(doc(userADb, "notifications/notif-nova"), {
          type: "new_content",
          title: "Invasão",
          summary: "Tenta criar do cliente",
          createdAt: new Date(),
        })
      );
    });

  } catch (err) {
    console.error("\n❌ Erro ao inicializar o ambiente de testes:", err.message);
    console.error("   Verifique se o Firebase Emulator está rodando:");
    console.error("   npm run firebase:emulators");
    process.exitCode = 1;
    return;
  } finally {
    await testEnv?.cleanup();
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`✅ ${passed} passando  |  ❌ ${failed} falhando`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
