/**
 * Testes de Regras do Firebase Emulator — Storage
 *
 * PRÉ-REQUISITO: Firebase Emulator deve estar ativo.
 *   npm run firebase:emulators
 *
 * Como executar:
 *   node firebase/test/storage-rules.test.mjs
 *
 * O que é testado:
 *   - Leitura de anexo de item publicado (permitida)
 *   - Leitura de anexo de rascunho (bloqueada)
 *   - Leitura de anexo de item em revisão (bloqueada)
 *   - Leitura de anexo de item excluído (bloqueada)
 *   - Upload por editor ativo (permitido)
 *   - Upload por conta inativa (bloqueado)
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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lê as regras de Storage
const storageRulesPath = join(__dirname, "../../firebase/storage.rules");

const PROJECT_ID = "tea-guia-storage-test";
let testEnv;

async function setupTestEnv() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "localhost",
      port: 8080,
    },
    storage: {
      host: "localhost",
      port: 9199,
      rules: readFileSync(storageRulesPath, "utf8"),
    },
  });
}

async function teardown() {
  await testEnv?.cleanup();
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

// ---------- Helpers ----------

async function seedKnowledgeItem(id, reviewStatus, deletedAt = null) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `knowledgeItems/${id}`), {
      reviewStatus,
      deletedAt,
      title: "Item de teste",
    });
  });
}

async function seedProfile(uid, role, status = "active") {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `profiles/${uid}`), {
      uid,
      role,
      status,
      email: `${uid}@test.com`,
    });
  });
}

function textBlob(content = "conteúdo de teste") {
  return new Blob([content], { type: "application/pdf" });
}

// ---------- Testes ----------

async function testStorageRead() {
  console.log("\n📂 Storage — Leitura de anexos");

  // Seed itens com diferentes status
  await seedKnowledgeItem("pub-item", "published");
  await seedKnowledgeItem("draft-item", "draft");
  await seedKnowledgeItem("review-item", "in_review");
  await seedKnowledgeItem("deleted-item", "published", new Date());

  // Usuário anônimo
  const anonCtx = testEnv.unauthenticatedContext();

  await test("leitura de anexo de item publicado é permitida", async () => {
    await assertSucceeds(
      getDownloadURL(ref(anonCtx.storage(), "knowledge/pub-item/doc.pdf"))
    );
  });

  await test("leitura de anexo de rascunho é bloqueada", async () => {
    await assertFails(
      getDownloadURL(ref(anonCtx.storage(), "knowledge/draft-item/doc.pdf"))
    );
  });

  await test("leitura de anexo de item em revisão é bloqueada", async () => {
    await assertFails(
      getDownloadURL(ref(anonCtx.storage(), "knowledge/review-item/doc.pdf"))
    );
  });

  await test("leitura de anexo de item excluído é bloqueada", async () => {
    await assertFails(
      getDownloadURL(ref(anonCtx.storage(), "knowledge/deleted-item/doc.pdf"))
    );
  });
}

async function testStorageWrite() {
  console.log("\n✍️  Storage — Escrita de anexos");

  const activeUid = "active-reviewer";
  const inactiveUid = "inactive-editor";

  await seedProfile(activeUid, "reviewer", "active");
  await seedProfile(inactiveUid, "professional", "blocked");

  const activeCtx = testEnv.authenticatedContext(activeUid);
  const inactiveCtx = testEnv.authenticatedContext(inactiveUid);
  const anonCtx = testEnv.unauthenticatedContext();

  await test("editor ativo pode fazer upload de PDF (≤5MB)", async () => {
    await assertSucceeds(
      uploadBytes(
        ref(activeCtx.storage(), "knowledge/pub-item/novo.pdf"),
        textBlob(),
        { contentType: "application/pdf" }
      )
    );
  });

  await test("conta inativa não pode fazer upload", async () => {
    await assertFails(
      uploadBytes(
        ref(inactiveCtx.storage(), "knowledge/pub-item/tentativa.pdf"),
        textBlob(),
        { contentType: "application/pdf" }
      )
    );
  });

  await test("usuário anônimo não pode fazer upload", async () => {
    await assertFails(
      uploadBytes(
        ref(anonCtx.storage(), "knowledge/pub-item/anonimo.pdf"),
        textBlob(),
        { contentType: "application/pdf" }
      )
    );
  });
}

// ---------- Main ----------

async function main() {
  console.log("🔥 Firebase Storage Rules Tests");
  console.log("   Emulador: localhost:9199\n");

  try {
    await setupTestEnv();
    await testEnv.clearStorage?.();

    await testStorageRead();
    await testStorageWrite();

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
