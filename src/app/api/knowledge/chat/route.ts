import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { createHash } from "crypto";
import { searchScientificReferences } from "@/services/scientificSearch";

export const dynamic = "force-dynamic";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getActiveSession } from "@/lib/security/authorization";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { knowledgeItemSchema } from "@/lib/validation/knowledge.schema";
import {
  childProfileSchema,
  COMMUNICATION_STYLE_LABELS,
  DIAGNOSIS_STATUS_LABELS,
  SUPPORT_LEVEL_LABELS,
} from "@/lib/validation/child-profile.schema";
import { formatAgeLabel } from "@/lib/utils/age";
import { FIRESTORE_COLLECTIONS } from "@/types/firestore";
import { logger } from "@/lib/observability/logger";
import { checkRateLimit } from "@/lib/security/rate-limit";

const SIMILARITY_THRESHOLD = 0.65;
const RATE_LIMIT_CONFIG = { maxRequests: 20, windowMs: 60_000 };
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora de expiração de cache

// Instrução básica de sistema para blindagem do LLM e disclaimer clínico
// Instrução básica de sistema para blindagem do LLM e disclaimer clínico
const SYSTEM_INSTRUCTION_BASE = `Você é o assistente virtual especializado do aplicativo "TEA Guia Inteligente".
Sua principal função é responder perguntas de pais, educadores e profissionais sobre o Transtorno do Espectro Autista (TEA) baseando-se no contexto de fichas clínicas e artigos científicos fornecidos abaixo.

DIRETRIZES OBRIGATÓRIAS:
1. DISCLAIMER CLÍNICO: Inicie ou conclua sua resposta destacando que as orientações fornecidas são puramente educativas e informativas, não substituindo o diagnóstico, a avaliação ou o tratamento médico e terapêutico especializado por profissionais habilitados.
2. LIMITAÇÃO DE CONTEXTO: Responda a pergunta utilizando APENAS os fatos e orientações presentes no CONTEXTO CLÍNICO DE REFERÊNCIA e nas REFERÊNCIAS CIENTÍFICAS EXTERNAS fornecidas abaixo. Não invente informações e não faça suposições clínicas sem embasamento nos textos fornecidos.
3. SE O CONTEXTO FOR INSUFICIENTE: Se os artigos e referências fornecidos não contiverem a resposta para a pergunta do usuário, responda honestamente: "Não encontrei informações validadas sobre este assunto específico na base clínica do guia nem nas pesquisas científicas recentes. Recomendo consultar um pediatra ou especialista no neurodesenvolvimento."
4. CITAÇÃO DAS FONTES: Ao formular a resposta baseada em um ou mais artigos, cite explicitamente o título de cada artigo. Para artigos científicos externos da internet, você DEVE incluir o link clicável direto para o artigo usando o formato Markdown [Título do Artigo](URL).
5. PROIBIÇÃO DE DIAGNÓSTICOS: Não forneça qualquer tipo de diagnóstico definitivo, triagem de nível ou recomendação/prescrição de tratamentos farmacológicos (medicamentos, dosagens).`;

// Schema Zod para validar e limitar o payload do chat
const chatPayloadSchema = z.object({
  message: z
    .string()
    .min(1, "A mensagem n\u00e3o pode estar vazia.")
    .max(2000, "A mensagem n\u00e3o pode exceder 2000 caracteres."),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        content: z.string().max(1000, "Cada mensagem do hist\u00f3rico n\u00e3o pode exceder 1000 caracteres."),
      })
    )
    .max(10, "O hist\u00f3rico n\u00e3o pode conter mais de 10 mensagens.")
    .optional()
    .default([]),
  // Fase 7 \u2014 perfil da crian\u00e7a selecionado para personalizar o tom da
  // resposta. Opcional: sem sele\u00e7\u00e3o, o assistente responde de forma neutra
  // (comportamento das fases anteriores, preservado).
  childId: z.string().min(1).optional(),
});

/**
 * Busca o perfil da crian\u00e7a (Fase 7) SOMENTE se ele pertencer ao usu\u00e1rio da
 * sess\u00e3o autenticada \u2014 nunca permite ler o perfil de outra conta, mesmo que
 * o childId seja adivinhado. Retorna `null` silenciosamente em qualquer
 * caso de erro/aus\u00eancia, para nunca quebrar o chat por causa da
 * personaliza\u00e7\u00e3o (ela \u00e9 um extra, n\u00e3o um requisito).
 */
async function buildChildContextBlock(
  ownerUid: string,
  childId: string | undefined,
): Promise<string> {
  if (!childId) return "";

  try {
    const db = getAdminFirestore();
    const snapshot = await db
      .collection(FIRESTORE_COLLECTIONS.children)
      .doc(ownerUid)
      .collection("profiles")
      .doc(childId)
      .get();

    if (!snapshot.exists) return "";

    const parsed = childProfileSchema.safeParse({ id: snapshot.id, ...snapshot.data() });
    if (!parsed.success) return "";

    const child = parsed.data;
    const age = formatAgeLabel(child.birthDate);
    const parts = [
      `idade: ${age}`,
      `status diagn\u00f3stico: ${DIAGNOSIS_STATUS_LABELS[child.diagnosisStatus]}`,
    ];
    if (child.supportLevel) parts.push(`n\u00edvel de suporte: ${SUPPORT_LEVEL_LABELS[child.supportLevel]}`);
    if (child.communicationStyle) {
      parts.push(`comunica\u00e7\u00e3o: ${COMMUNICATION_STYLE_LABELS[child.communicationStyle]}`);
    }
    if (child.interests.length > 0) parts.push(`interesses: ${child.interests.join(", ")}`);
    if (child.sensitivities.length > 0) {
      parts.push(`sensibilidades: ${child.sensitivities.join(", ")}`);
    }

    return `\n\nCONTEXTO DA CRIAN\u00c7A (uso exclusivo para calibrar tom, exemplos e n\u00edvel de linguagem \u2014 NUNCA para diagnosticar ou avaliar clinicamente):\n${parts.join("; ")}.\nUse essas informa\u00e7\u00f5es apenas para tornar a explica\u00e7\u00e3o mais pr\u00e1tica (ex.: sugerir exemplos com os interesses da crian\u00e7a, evitar recomenda\u00e7\u00f5es que conflitem com as sensibilidades informadas). Continue seguindo TODAS as diretrizes obrigat\u00f3rias acima, especialmente a proibi\u00e7\u00e3o de diagn\u00f3sticos.`;
  } catch (err) {
    console.error("Erro ao carregar perfil da crian\u00e7a para personaliza\u00e7\u00e3o do chat:", err);
    return "";
  }
}

type ChatMessage = z.infer<typeof chatPayloadSchema>["history"][number];

type GeminiContent = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

export async function POST(request: NextRequest) {
  let userId = "unknown";
  try {
    // 1. Valida autenticação e conta ativa no servidor
    const activeSession = await getActiveSession();
    if (!activeSession) {
      return NextResponse.json(
        { error: "Acesso negado. É necessário estar autenticado e com conta ativa para usar o assistente de IA." },
        { status: 401 }
      );
    }

    // 1b. Rate limit centralizado: 20 requisições por minuto por usuário
    const { sessionUser } = activeSession;
    userId = sessionUser.uid;
    const rateLimitRes = checkRateLimit(`chat:${userId}`, RATE_LIMIT_CONFIG);
    if (!rateLimitRes.success) {
      logger.warn("Chat rate limit exceeded", { userId: sessionUser.uid });
      return NextResponse.json(
        { error: "Limite de requisições excedido. Aguarde 1 minuto antes de enviar uma nova mensagem." },
        { status: 429 }
      );
    }

    // 2. Valida e limita o payload via schema Zod
    const body = await request.json().catch(() => ({}));
    const parsed = chatPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Payload inválido." },
        { status: 400 }
      );
    }
    const { message, history, childId } = parsed.data;

    // 2b. Verifica cache de respostas RAG no Firestore (Isolamento por conta do usuário)
    // O cache é desativado em ambiente de desenvolvimento ou emulador para evitar respostas mockadas repetitivas
    const isEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
    const isDev = process.env.NODE_ENV === "development";
    const useCache = !isEmulator && !isDev;

    const queryHash = createHash("sha256")
      .update(`${message.trim().toLowerCase()}_${childId ?? ""}_${sessionUser.uid}`)
      .digest("hex");

    const db = getAdminFirestore();

    if (useCache) {
      const cacheSnap = await db.collection("chatResponseCache").doc(queryHash).get();
      if (cacheSnap.exists) {
        const cacheData = cacheSnap.data();
        const createdAt = cacheData?.createdAt?.toDate();
        if (cacheData && createdAt && Date.now() - createdAt.getTime() < CACHE_TTL_MS) {
          logger.info("Chat cache hit", { userId: sessionUser.uid, queryHash });
          const responseText = cacheData.response as string;
          const sources = cacheData.sources || [];
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              const chunks = responseText.split(" ");
              for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk + " "));
                await new Promise((resolve) => setTimeout(resolve, 30));
              }
              controller.close();
            },
          });

          const headers = new Headers();
          headers.set("Content-Type", "text/plain; charset=utf-8");
          headers.set("x-sources-metadata", JSON.stringify(sources));
          return new Response(stream, { headers });
        }
      }
    }

    logger.info("Chat cache miss. Generating new response via Gemini.", { userId: sessionUser.uid, queryHash });

    // 3. RAG - Passo 1: Gerar o embedding da pergunta atual
    let queryEmbedding: number[];
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey && (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" || process.env.NODE_ENV === "development")) {
      // Mock de vetor para desenvolvimento local sem chave do Gemini
      queryEmbedding = new Array(768).fill(0).map(() => Math.random() * 0.1);
    } else {
      if (!apiKey) {
        return NextResponse.json(
          { error: "Chave GEMINI_API_KEY não configurada no servidor." },
          { status: 500 }
        );
      }

      try {
        const ai = new GoogleGenAI({ apiKey, vertexai: false });
        const response = await ai.models.embedContent({
          model: "gemini-embedding-2",
          contents: message.trim(),
          config: {
            outputDimensionality: 768,
          },
        });

        if (!response.embeddings?.[0]?.values) {
          return NextResponse.json(
            { error: "Erro ao vetorizar a pergunta para busca." },
            { status: 502 }
          );
        }
        queryEmbedding = response.embeddings[0].values;
      } catch (err) {
        console.error("Erro ao gerar embedding no chat:", err);
        return NextResponse.json(
          { error: "Falha ao gerar embeddings." },
          { status: 502 }
        );
      }
    }

    // RAG - Passo 2: Busca artigos semelhantes no Firestore

    const queryBase = db
      .collection("knowledgeItems")
      .where("reviewStatus", "==", "published")
      .where("deletedAt", "==", null);

    const vectorQuery = queryBase.findNearest({
      vectorField: "embedding",
      queryVector: FieldValue.vector(queryEmbedding),
      limit: 4, // Trazemos os top 4 mais próximos
      distanceMeasure: "COSINE",
      distanceResultField: "searchDistance",
    });

    const snapshot = await vectorQuery.get();

    // Filtra artigos pelo limiar de similaridade de cosseno
    const validItems = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        const distance = data.searchDistance ?? 1.0;
        const similarity = 1 - distance;

        const dataToValidate = { ...data };
        delete dataToValidate.embedding;

        const parsed = knowledgeItemSchema.safeParse({ id: docSnap.id, ...dataToValidate });
        if (!parsed.success) return null;

        return {
          ...parsed.data,
          similarity,
        };
      })
      .filter((item): item is Exclude<typeof item, null> => item !== null)
      .filter((item) => item.similarity >= SIMILARITY_THRESHOLD);

    // RAG - Passo 3: Montagem do contexto e das referências (fontes)
    let contextText = "";
    const localSources = validItems.map((item) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
    }));

    if (validItems.length > 0) {
      contextText = "\n\nCONTEXTO CLÍNICO DE REFERÊNCIA:\n" +
        validItems.map((item, idx) => `--- ARTIGO ${idx + 1}: ${item.title} ---\n${item.content}`).join("\n\n");
    } else {
      contextText = "\n\nNÃO há artigos validados correspondentes ao termo no contexto.";
    }

    // Busca referências na internet (Europe PMC / PubMed)
    let scientificArticlesText = "";
    const externalSources: Array<{ id: string; title: string; url: string; external: boolean }> = [];
    if (apiKey) {
      const externalRefs = await searchScientificReferences(message, apiKey);
      if (externalRefs.length > 0) {
        scientificArticlesText = "\n\nREFERÊNCIAS CIENTÍFICAS EXTERNAS (INTERNET):\n" +
          externalRefs.map((art, idx) => `--- ARTIGO EXTERNO ${idx + 1}: ${art.title} ---\nAutores: ${art.authors}\nPeriódico: ${art.journal} (${art.year})\nResumo: ${art.abstractText}\nLink: ${art.url}`).join("\n\n");
        externalRefs.forEach((art, idx) => {
          externalSources.push({
            id: `ext-${idx}-${Date.now()}`,
            title: `${art.title} (${art.journal}, ${art.year})`,
            url: art.url,
            external: true,
          });
        });

        // Se não houver nenhum artigo validado local correspondente, gera e insere a ficha no Firestore em background para enriquecer a base
        if (validItems.length === 0 && externalRefs[0]) {
          try {
            const ai = new GoogleGenAI({ apiKey, vertexai: false });
            const primeArt = externalRefs[0];
            const consolidationPrompt = `Consolide as seguintes referências científicas sobre o autismo e gere um artigo clínico prático em PORTUGUÊS.
Artigo: "${primeArt.title}"
Resumo original: "${primeArt.abstractText}"
Autores: "${primeArt.authors}"
Ano/Jornal: "${primeArt.year} / ${primeArt.journal}"

Retorne uma estrutura JSON válida exatamente com os seguintes campos (sem tags de código markdown):
{
  "title": "Título prático, amigável e informativo da ficha em português",
  "summary": "Resumo de até 350 caracteres das orientações em português",
  "content": "Conteúdo clínico prático detalhado com orientações para a família (mínimo de 3 parágrafos, formatado em português)",
  "evidenceLevel": "Qualidade da evidência científica. Deve ser obrigatoriamente um destes: 'low', 'moderate', 'high' ou 'expert_consensus'",
  "ageRange": "Faixa etária recomendada, ex: 'Todas as idades', '2 a 6 anos'",
  "tags": ["lista", "de", "palavras-chave", "relevantes"]
}`;

            const genRes = await ai.models.generateContent({
              model: "gemini-1.5-flash",
              contents: consolidationPrompt,
              config: {
                responseMimeType: "application/json",
                temperature: 0.2
              }
            });

            const genText = genRes.text;
            if (genText) {
              const generatedJson = JSON.parse(genText.trim());
              const slugify = (text: string) => text
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
                
              const itemSlug = slugify(generatedJson.title || `chat-auto-${Date.now()}`);
              const docId = `auto-${itemSlug}`;
              const docRef = db.collection("knowledgeItems").doc(docId);
              
              const docSnap = await docRef.get();
              if (!docSnap.exists) {
                const categoriesSnap = await db.collection("categories").limit(1).get();
                const defaultCategoryId = categoriesSnap.docs[0]?.id || "geral";
                
                const textToEmbed = `${generatedJson.title}\n${generatedJson.summary}\n${generatedJson.content}\nTags: ${(generatedJson.tags || []).join(", ")}`;
                const embeddingResponse = await ai.models.embedContent({
                  model: "gemini-embedding-2",
                  contents: textToEmbed,
                  config: {
                    outputDimensionality: 768,
                  },
                });
                
                const newEmbedding = embeddingResponse.embeddings?.[0]?.values;
                if (newEmbedding) {
                  await docRef.set({
                    categoryId: defaultCategoryId,
                    title: generatedJson.title.substring(0, 160),
                    slug: itemSlug.substring(0, 160),
                    summary: generatedJson.summary.substring(0, 400),
                    content: generatedJson.content,
                    targetAudience: ["family", "general"],
                    ageRange: (generatedJson.ageRange || "Todas as idades").substring(0, 40),
                    tags: Array.isArray(generatedJson.tags) ? generatedJson.tags : [],
                    evidenceLevel: ["low", "moderate", "high", "expert_consensus"].includes(generatedJson.evidenceLevel) ? generatedJson.evidenceLevel : "high",
                    reviewStatus: "published",
                    version: 1,
                    createdBy: "auto-ingest-agent",
                    deletedAt: null,
                    attachments: [],
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    embedding: FieldValue.vector(newEmbedding),
                    embeddingVersion: 1
                  });
                  logger.info("Nova ficha clínica gerada no chat e ingerida com sucesso no Firestore", { docId });
                }
              }
            }
          } catch (eIngest) {
            console.error("Erro ao processar auto-ingestão em background do chat:", eIngest);
          }
        }
      }
    }

    // Combina fontes locais e externas sob a variável comum sources
    const sources = [
      ...localSources.map(s => ({ ...s, external: false })),
      ...externalSources
    ];

    // Fase 7 — se um perfil de criança foi selecionado (e pertence ao
    // usuário autenticado), adiciona um bloco curto de contexto para
    // calibrar o tom da resposta. Nunca afeta a busca vetorial nem os
    // artigos recuperados — apenas a formulação da resposta final.
    const childContextBlock = await buildChildContextBlock(sessionUser.uid, childId);

    const systemInstruction = SYSTEM_INSTRUCTION_BASE + contextText + scientificArticlesText + childContextBlock;

    // RAG - Passo 4: Formatação do histórico para a API do Gemini
    // O histórico já foi validado pelo schema Zod (máx. 10 items, role e content validados)
    const geminiContents: GeminiContent[] = [];

    // Limita o histórico às últimas 6 mensagens para evitar estouro de prompt e economizar tokens
    const recentHistory: ChatMessage[] = history.slice(-6);
    for (const msg of recentHistory) {
      geminiContents.push({
        role: msg.role,
        parts: [{ text: msg.content }],
      });
    }

    // Adiciona a última mensagem do usuário
    geminiContents.push({
      role: "user",
      parts: [{ text: message.trim() }],
    });

    // RAG - Passo 5: Geração de resposta com streaming
    const provider = process.env.LLM_PROVIDER || "gemini";
    const chatApiKey = provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.GEMINI_API_KEY;

    if (!chatApiKey && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
      // Em modo emulador sem chave, simulamos o stream de resposta
      const firstItem = validItems[0];
      const mockResponse = firstItem
        ? `[DISCLAIMER EDUCACIONAL: Este conteúdo é informativo.]\n\nBaseado no artigo "${firstItem.title}", a ecolalia ou sintomas relacionados referem-se a padrões comportamentais comuns. Como orientações práticas, reduza estímulos e ofereça apoio à comunicação. Se precisar de mais assistência, procure um profissional habilitado.`
        : "Não encontrei informações validadas sobre este assunto específico na base clínica do guia. Recomendo consultar um pediatra ou especialista no neurodesenvolvimento.";

      // Grava no cache de forma assíncrona
      db.collection("chatResponseCache").doc(queryHash).set({
        userId: sessionUser.uid,
        queryHash,
        response: mockResponse,
        sources,
        createdAt: FieldValue.serverTimestamp(),
      }).catch(err => logger.warn("Failed to write mock response to cache", { userId: sessionUser.uid }, err));

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // Envia em fatias simulando streaming
          const chunks = mockResponse.split(" ");
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk + " "));
            await new Promise((resolve) => setTimeout(resolve, 80));
          }
          controller.close();
        },
      });

      const headers = new Headers();
      headers.set("Content-Type", "text/plain; charset=utf-8");
      headers.set("x-sources-metadata", JSON.stringify(sources));

      return new Response(stream, { headers });
    }

    if (provider === "openrouter") {
      if (!chatApiKey) {
        return NextResponse.json(
          { error: "Chave OPENROUTER_API_KEY não configurada no servidor." },
          { status: 500 }
        );
      }

      const openRouterModel = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";
      const messages = [
        { role: "system", content: systemInstruction },
        ...geminiContents.map((content) => ({
          role: content.role === "model" ? "assistant" : "user",
          content: content.parts[0]?.text || "",
        })),
      ];

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${chatApiKey}`,
          "HTTP-Referer": "https://github.com/ctorres4564/tea-guia-inteligente",
          "X-Title": "TEA Guia Inteligente",
        },
        body: JSON.stringify({
          model: openRouterModel,
          messages,
          temperature: 0.2,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Erro na API do OpenRouter", { errorText });
        return NextResponse.json(
          { error: "Erro ao comunicar com o OpenRouter/DeepSeek." },
          { status: 502 }
        );
      }

      const STREAM_TIMEOUT_MS = 30_000;
      const encoder = new TextEncoder();
      let streamClosed = false;
      let fullResponse = "";

      const stream = new ReadableStream({
        async start(controller) {
          const timeoutId = setTimeout(() => {
            if (!streamClosed) {
              streamClosed = true;
              try {
                controller.enqueue(
                  encoder.encode("\n\n[AVISO: A resposta foi interrompida por tempo limite. Tente uma pergunta mais específica.]")
                );
                controller.close();
              } catch {}
            }
          }, STREAM_TIMEOUT_MS);

          try {
            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error("Nenhum stream de leitura disponivel no response.");
            }

            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (!streamClosed) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const cleanedLine = line.trim();
                if (!cleanedLine) continue;
                if (cleanedLine === "data: [DONE]") {
                  streamClosed = true;
                  break;
                }

                if (cleanedLine.startsWith("data: ")) {
                  try {
                    const parsed = JSON.parse(cleanedLine.substring(6));
                    const content = parsed.choices?.[0]?.delta?.content || "";
                    if (content) {
                      fullResponse += content;
                      controller.enqueue(encoder.encode(content));
                    }
                  } catch (e) {
                    // Ignora parsing invalido de chunks parciais
                  }
                }
              }
            }

            if (!streamClosed && fullResponse.trim().length > 0) {
              db.collection("chatResponseCache").doc(queryHash).set({
                userId: sessionUser.uid,
                queryHash,
                response: fullResponse,
                sources,
                createdAt: FieldValue.serverTimestamp(),
              }).then(() => {
                logger.info("Chat cache populated", { userId: sessionUser.uid, queryHash });
              }).catch(err => {
                logger.warn("Failed to write response to cache", { userId: sessionUser.uid }, err);
              });
            }
          } catch (err) {
            logger.error("Erro durante o processamento do stream do OpenRouter", { userId: sessionUser.uid }, err);
            if (!streamClosed) {
              try {
                controller.enqueue(encoder.encode("\n[ERRO: Conexão interrompida com o serviço de IA.]"));
              } catch {}
            }
          } finally {
            clearTimeout(timeoutId);
            if (!streamClosed) {
              streamClosed = true;
              try {
                controller.close();
              } catch {}
            }
          }
        },
      });

      const headers = new Headers();
      headers.set("Content-Type", "text/plain; charset=utf-8");
      headers.set("x-sources-metadata", JSON.stringify(sources));

      return new Response(stream, { headers });
    }

    if (!chatApiKey) {
      return NextResponse.json(
        { error: "Chave GEMINI_API_KEY não configurada no servidor." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: chatApiKey, vertexai: false });
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-1.5-flash",
      contents: geminiContents,
      config: {
        systemInstruction,
        temperature: 0.2, // Baixa criatividade para garantir fidelidade ao texto de origem
      },
    });

    // Timeout efetivo de 30 segundos: usa flag streamClosed + setTimeout que
    // fecha o controller diretamente.
    const STREAM_TIMEOUT_MS = 30_000;
    const encoder = new TextEncoder();
    let streamClosed = false;
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        const timeoutId = setTimeout(() => {
          if (!streamClosed) {
            streamClosed = true;
            try {
              controller.enqueue(
                encoder.encode("\n\n[AVISO: A resposta foi interrompida por tempo limite. Tente uma pergunta mais específica.]")
              );
              controller.close();
            } catch {
              // controller pode já ter sido fechado
            }
          }
        }, STREAM_TIMEOUT_MS);

        try {
          for await (const chunk of responseStream) {
            if (streamClosed) break;
            if (chunk.text) {
              fullResponse += chunk.text;
              controller.enqueue(encoder.encode(chunk.text));
            }
          }

          // Se a resposta completou sem timeout, persiste no cache
          if (!streamClosed && fullResponse.trim().length > 0) {
            db.collection("chatResponseCache").doc(queryHash).set({
              userId: sessionUser.uid,
              queryHash,
              response: fullResponse,
              sources,
              createdAt: FieldValue.serverTimestamp(),
            }).then(() => {
              logger.info("Chat cache populated", { userId: sessionUser.uid, queryHash });
            }).catch(err => {
              logger.warn("Failed to write response to cache", { userId: sessionUser.uid }, err);
            });
          }
        } catch (err) {
          logger.error("Erro durante o processamento do stream do Gemini", { userId: sessionUser.uid }, err);
          if (!streamClosed) {
            try {
              controller.enqueue(encoder.encode("\n[ERRO: Conexão interrompida com o serviço de IA.]"));
            } catch {
              // controller já fechado
            }
          }
        } finally {
          clearTimeout(timeoutId);
          if (!streamClosed) {
            streamClosed = true;
            try {
              controller.close();
            } catch {
              // já fechado
            }
          }
        }
      },
    });

    const headers = new Headers();
    headers.set("Content-Type", "text/plain; charset=utf-8");
    headers.set("x-sources-metadata", JSON.stringify(sources));

    return new Response(stream, { headers });
  } catch (error) {
    logger.error("Erro no Route Handler de RAG", { userId }, error);
    const mappedError = mapFirebaseError(error);
    return NextResponse.json(
      { error: mappedError.message || "Erro interno ao processar a resposta do assistente." },
      { status: 500 }
    );
  }
}

