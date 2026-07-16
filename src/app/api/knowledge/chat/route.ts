import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getActiveSession } from "@/lib/security/authorization";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { knowledgeItemSchema } from "@/lib/validation/knowledge.schema";

const SIMILARITY_THRESHOLD = 0.65;

// Instrução básica de sistema para blindagem do LLM e disclaimer clínico
const SYSTEM_INSTRUCTION_BASE = `Você é o assistente virtual especializado do aplicativo "TEA Guia Inteligente".
Sua principal função é responder perguntas de pais, educadores e profissionais sobre o Transtorno do Espectro Autista (TEA) baseando-se ESTREITAMENTE no contexto de fichas clínicas fornecido abaixo.

DIRETRIZES OBRIGATÓRIAS:
1. DISCLAIMER CLÍNICO: Inicie ou conclua sua resposta destacando que as orientações fornecidas são puramente educativas e informativas, não substituindo o diagnóstico, a avaliação ou o tratamento médico e terapêutico especializado por profissionais habilitados.
2. LIMITAÇÃO DE CONTEXTO: Responda a pergunta utilizando APENAS os fatos e orientações presentes nos artigos fornecidos no contexto clínico abaixo. Não invente informações, não utilize conhecimento geral não validado fora do contexto e não faça suposições clínicas.
3. SE O CONTEXTO FOR INSUFICIENTE: Se os artigos fornecidos não contiverem a resposta para a pergunta do usuário, responda honestamente: "Não encontrei informações validadas sobre este assunto específico na base clínica do guia. Recomendo consultar um pediatra ou especialista no neurodesenvolvimento."
4. CITAÇÃO DAS FONTES: Ao formular a resposta baseada em um ou mais artigos, cite explicitamente o título de cada artigo que embasou as orientações.
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
});

type ChatMessage = z.infer<typeof chatPayloadSchema>["history"][number];

type GeminiContent = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

export async function POST(request: NextRequest) {
  try {
    // 1. Valida autenticação e conta ativa no servidor
    const activeSession = await getActiveSession();
    if (!activeSession) {
      return NextResponse.json(
        { error: "Acesso negado. É necessário estar autenticado e com conta ativa para usar o assistente de IA." },
        { status: 401 }
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
    const { message, history } = parsed.data;

    // 3. RAG - Passo 1: Gerar o embedding da pergunta atual
    let queryEmbedding: number[];
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
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
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.embedContent({
          model: "text-embedding-004",
          contents: message.trim(),
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
    const db = getAdminFirestore();
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

        const parsed = knowledgeItemSchema.safeParse({ id: docSnap.id, ...data });
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
    const sources = validItems.map((item) => ({
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

    const systemInstruction = SYSTEM_INSTRUCTION_BASE + contextText;

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
    if (!apiKey && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
      // Em modo emulador sem chave, simulamos o stream de resposta
      const firstItem = validItems[0];
      const mockResponse = firstItem
        ? `[DISCLAIMER EDUCACIONAL: Este conteúdo é informativo.]\n\nBaseado no artigo "${firstItem.title}", a ecolalia ou sintomas relacionados referem-se a padrões comportamentais comuns. Como orientações práticas, reduza estímulos e ofereça apoio à comunicação. Se precisar de mais assistência, procure um profissional habilitado.`
        : "Não encontrei informações validadas sobre este assunto específico na base clínica do guia. Recomendo consultar um pediatra ou especialista no neurodesenvolvimento.";

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

    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave GEMINI_API_KEY não configurada no servidor." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-1.5-flash",
      contents: geminiContents,
      config: {
        systemInstruction,
        temperature: 0.2, // Baixa criatividade para garantir fidelidade ao texto de origem
      },
    });

    // Converte o stream do Gemini para um ReadableStream HTTP
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            if (chunk.text) {
              controller.enqueue(encoder.encode(chunk.text));
            }
          }
        } catch (err) {
          console.error("Erro durante o processamento do stream do Gemini:", err);
          controller.enqueue(encoder.encode("\n[ERRO: Conexão interrompida com o serviço de IA.]"));
        } finally {
          controller.close();
        }
      },
    });

    const headers = new Headers();
    headers.set("Content-Type", "text/plain; charset=utf-8");
    headers.set("x-sources-metadata", JSON.stringify(sources));

    return new Response(stream, { headers });
  } catch (error) {
    console.error("Erro no Route Handler de RAG:", error);
    const mappedError = mapFirebaseError(error);
    return NextResponse.json(
      { error: mappedError.message || "Erro interno ao processar a resposta do assistente." },
      { status: 500 }
    );
  }
}
