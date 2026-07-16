/**
 * Testes de Regras do Firebase Emulator — Storage
 *
 * PRÉ-REQUISITO: Firebase Emulator deve estar ativo.
 *   npm run firebase:emulators
 *
 * Como executar:
 *   npm run test:storage
 *
 * Cenários cobertos:
 *   - Leitura de anexo publicado (permitida)
 *   - Leitura de rascunho/revisão/excluído (bloqueada)
 *   - Upload por editor ativo (permitido)
 *   - Upload por conta inativa (bloqueado)
 *   - Upload por anônimo (bloqueado)
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const storageRulesPath = join(__dirname, "../../firebase/storage.rules");
const firestoreRulesPath = join(__dirname, "../../firebase/firestore.rules");

// IMPORTANTE: deve ser igual ao projeto em .firebaserc ("tea-guia-inteligente")
// porque as regras de Storage fazem firestore.get() cross-service usando o
// projeto do emulador iniciado via `firebase emulators:start`.
const PROJECT_ID = "tea-guia-inteligente";
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

// ---------- Helpers ----------

function textBlob(content = "conteúdo de teste") {
  return new Uint8Array(Buffer.from(content));
}

// ---------- Main ----------

async function main() {
  console.log("🔥 Firebase Storage Rules Tests");
  console.log("   Emulador: localhost:9199\n");

  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: "localhost",
        port: 8080,
        rules: readFileSync(firestoreRulesPath, "utf8"),
      },
      storage: {
        host: "localhost",
        port: 9199,
        rules: readFileSync(storageRulesPath, "utf8"),
      },
    });

    // Limpa estado anterior
    await testEnv.clearFirestore();

    // Seed: perfis e itens base em uma única chamada admin
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();

      // Perfis
      await setDoc(doc(db, "profiles/reviewer-storage"), {
        uid: "reviewer-storage", role: "reviewer", status: "active",
        email: "rev@test.com", displayName: "Reviewer",
      });
      await setDoc(doc(db, "profiles/inactive-storage"), {
        uid: "inactive-storage", role: "professional", status: "blocked",
        email: "inactive@test.com", displayName: "Inactive",
      });

      // Itens com diferentes status
      await setDoc(doc(db, "knowledgeItems/item-published"), {
        reviewStatus: "published", deletedAt: null, title: "Publicado",
      });
      await setDoc(doc(db, "knowledgeItems/item-draft"), {
        reviewStatus: "draft", deletedAt: null, title: "Rascunho",
      });
      await setDoc(doc(db, "knowledgeItems/item-review"), {
        reviewStatus: "in_review", deletedAt: null, title: "Em revisão",
      });
      await setDoc(doc(db, "knowledgeItems/item-deleted"), {
        reviewStatus: "published", deletedAt: new Date(), title: "Excluído",
      });
    });

    // Referências de Storage obtidas UMA ÚNICA VEZ por usuário
    const anonStorage = testEnv.unauthenticatedContext().storage();
    const reviewerStorage = testEnv.authenticatedContext("reviewer-storage").storage();
    const inactiveStorage = testEnv.authenticatedContext("inactive-storage").storage();

    // Upload de um arquivo "publicado" para testar leitura
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminStorage = ctx.storage();
      await uploadBytes(
        ref(adminStorage, "knowledge/item-published/doc.pdf"),
        textBlob("conteúdo publicado"),
        { contentType: "application/pdf" }
      );
    });

    // =====================================================
    // Suíte 1: Leitura de anexos
    // =====================================================
    console.log("📂 Storage — Leitura de anexos");

    await test("leitura de anexo de item publicado é permitida (anônimo)", async () => {
      await assertSucceeds(
        getBytes(ref(anonStorage, "knowledge/item-published/doc.pdf"))
      );
    });

    await test("leitura de anexo de rascunho é bloqueada", async () => {
      await assertFails(
        getBytes(ref(anonStorage, "knowledge/item-draft/doc.pdf"))
      );
    });

    await test("leitura de anexo de item em revisão é bloqueada", async () => {
      await assertFails(
        getBytes(ref(anonStorage, "knowledge/item-review/doc.pdf"))
      );
    });

    await test("leitura de anexo de item excluído é bloqueada", async () => {
      await assertFails(
        getBytes(ref(anonStorage, "knowledge/item-deleted/doc.pdf"))
      );
    });

    // =====================================================
    // Suíte 2: Escrita de anexos
    // =====================================================
    console.log("\n✍️  Storage — Escrita de anexos");

    await test("editor ativo pode fazer upload de PDF", async () => {
      await assertSucceeds(
        uploadBytes(
          ref(reviewerStorage, "knowledge/item-published/novo.pdf"),
          textBlob("novo conteúdo"),
          { contentType: "application/pdf" }
        )
      );
    });

    await test("conta inativa/bloqueada não pode fazer upload", async () => {
      await assertFails(
        uploadBytes(
          ref(inactiveStorage, "knowledge/item-published/tentativa.pdf"),
          textBlob("bloqueado"),
          { contentType: "application/pdf" }
        )
      );
    });

    await test("usuário anônimo não pode fazer upload", async () => {
      await assertFails(
        uploadBytes(
          ref(anonStorage, "knowledge/item-published/anonimo.pdf"),
          textBlob("anônimo"),
          { contentType: "application/pdf" }
        )
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
