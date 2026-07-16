/**
 * Script administrativo — gera embeddings retroativamente para todos os conteúdos
 * clínicos publicados no Firestore que ainda não possuem o vetor de embeddings.
 *
 * Suporta execução tanto local contra o Firestore Emulator quanto contra o projeto real.
 *
 * Uso (com emuladores locais):
 *   $ export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
 *   $ node scripts/generate-all-embeddings.mjs
 *
 * Uso (contra banco de produção - requer GEMINI_API_KEY e credenciais do Firebase):
 *   $ node --env-file=.env.local scripts/generate-all-embeddings.mjs
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

// 1. Inicializa o Firebase Admin SDK
function initFirebase() {
  if (getApps().length > 0) return;

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
  if (emulatorHost) {
    console.log("Conectando ao Firestore Emulator...");
    // Em modo emulador, usamos um ID de projeto de demonstração
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
    initializeApp({ projectId: "demo-tea-guia-inteligente" });
    return;
  }

  console.log("Conectando ao Firebase de Produção/Staging...");
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp();
  } else {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Variáveis de ambiente do Firebase Admin ausentes (.env.local não carregado ou variáveis não definidas no shell)."
      );
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
  }
}

async function main() {
  initFirebase();
  const db = getFirestore();

  const apiKey = process.env.GEMINI_API_KEY;
  const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  if (!apiKey) {
    if (isEmulator) {
      console.warn("[AVISO] GEMINI_API_KEY não encontrada. Usando modo MOCK para geração local no emulador.");
    } else {
      throw new Error("GEMINI_API_KEY é obrigatória para processamento real no banco de dados.");
    }
  }

  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  console.log("Buscando conteúdos publicados...");
  const snapshot = await db
    .collection("knowledgeItems")
    .where("reviewStatus", "==", "published")
    .get();

  if (snapshot.empty) {
    console.log("Nenhum conteúdo publicado encontrado.");
    return;
  }

  console.log(`Encontrados ${snapshot.size} conteúdos. Verificando embeddings ausentes...`);

  let countUpdated = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const hasEmbedding = data.embedding && 
                         Array.isArray(data.embedding.values) && 
                         data.embedding.values.length === 768 && 
                         data.embeddingVersion === 1;

    if (hasEmbedding) {
      console.log(`[-] Pulando: "${data.title}" (já possui embedding versão 1 gerado pelo gemini-embedding-2)`);
      continue;
    }

    console.log(`[/] Processando: "${data.title}"...`);

    const title = data.title || "";
    const summary = data.summary || "";
    const content = data.content || "";
    const tags = Array.isArray(data.tags) ? data.tags.join(", ") : "";
    const textToEmbed = `${title}\n${summary}\n${content}\nTags: ${tags}`;

    let embeddingValues;

    if (!ai) {
      // Mock de vetor para desenvolvimento sem chave API
      embeddingValues = new Array(768).fill(0).map(() => Math.random() * 0.1);
    } else {
      try {
        const response = await ai.models.embedContent({
          model: "gemini-embedding-2",
          contents: textToEmbed,
          config: {
            outputDimensionality: 768,
          },
        });

        if (!response.embeddings?.[0]?.values) {
          console.error(`[ERRO] Embedding inválido para "${data.title}".`);
          continue;
        }

        embeddingValues = response.embeddings[0].values;
      } catch (err) {
        console.error(`[ERRO] Falha ao gerar embedding do Gemini para "${data.title}":`, err.message);
        continue;
      }
    }

    await docSnap.ref.update({
      embedding: FieldValue.vector(embeddingValues),
      embeddingVersion: 1,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[+] Sucesso: "${data.title}" vetorizado e gravado.`);
    countUpdated++;
  }

  console.log(`Processamento concluído. ${countUpdated} documentos atualizados.`);
}

main().catch((error) => {
  console.error("Falha ao executar o script:", error);
  process.exit(1);
});
