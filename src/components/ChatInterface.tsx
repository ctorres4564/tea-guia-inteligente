"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button, Input, Alert, Select } from "@/components/ui";
import { toggleFavorite, listFavorites } from "@/domains/favorites/service";
import { addHistoryEntry } from "@/domains/history/service";
import { listChildren } from "@/domains/children/service";
import { formatAgeLabel } from "@/lib/utils/age";
import type { ChildProfile } from "@/lib/validation/child-profile.schema";

interface SourceArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  evidenceLevel: "low" | "moderate" | "high" | "expert_consensus";
  ageRange?: string;
}

interface Message {
  role: "user" | "model";
  content: string;
  sources?: SourceArticle[];
}

const EVIDENCE_LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "Evidência Baixa", color: "bg-red-50 text-red-700 border-red-200" },
  moderate: { label: "Evidência Moderada", color: "bg-amber-50 text-amber-700 border-amber-200" },
  high: { label: "Evidência Alta", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expert_consensus: { label: "Consenso de Especialistas", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

export function ChatInterface() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para Favoritos e Visualização Completa
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [activeArticle, setActiveArticle] = useState<SourceArticle | null>(null);

  // Fase 7 — perfil da criança selecionado para personalizar o tom das respostas
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Rolagem automática para o final das mensagens
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const loadFavorites = async () => {
      if (!user) return;
      try {
        const favs = await listFavorites(user.uid);
        setFavIds(new Set(favs.map((f) => f.knowledgeItemId)));
      } catch (err) {
        console.error("Erro ao carregar favoritos:", err);
      }
    };

    if (user) {
      loadFavorites();
    }
  }, [user]);

  useEffect(() => {
    const loadChildren = async () => {
      if (!user) return;
      try {
        const list = await listChildren(user.uid);
        setChildren(list);
      } catch (err) {
        console.error("Erro ao carregar perfis de crianças:", err);
      }
    };

    if (user) {
      loadChildren();
    }
  }, [user]);

  // Preenche o input se o query param q estiver presente na URL (Redirecionamento do histórico)
  useEffect(() => {
    const queryParam = searchParams.get("q");
    if (queryParam && queryParam.trim().length > 0 && messages.length === 0) {
      setInput(queryParam);
    }
  }, [searchParams, messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    // 1. Adiciona a mensagem do usuário ao histórico local
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // 2. Registra a pergunta do usuário no histórico do Firestore
      if (user) {
        await addHistoryEntry(user.uid, {
          type: "question",
          query: userMessage,
        });
      }

      // 3. Dispara a chamada ao Route Handler do RAG
      const response = await fetch("/api/knowledge/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          history: messages, // passa o histórico anterior
          childId: selectedChildId || undefined, // Fase 7 — personalização opcional
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Falha na comunicação com o assistente.");
      }

      // 4. Lê o cabeçalho de metadados das fontes consultadas
      const sourcesHeader = response.headers.get("x-sources-metadata");
      const sources: SourceArticle[] = sourcesHeader ? JSON.parse(sourcesHeader) : [];

      // 5. Inicia a leitura do stream de texto
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let aiText = "";

      // Adiciona o balão de resposta inicial da IA como vazio
      setMessages((prev) => [...prev, { role: "model", content: "", sources }]);

      while (!done && reader) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          aiText += chunk;

          // Atualiza continuamente o balão de resposta da IA na tela
          setMessages((prev) => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg && lastMsg.role === "model") {
              lastMsg.content = aiText;
            }
            return updated;
          });
        }
      }
    } catch (err: any) {
      console.error("Erro na conversação:", err);
      setError(err.message || "Erro de conexão ao tentar enviar a mensagem.");
      // Remove a última mensagem em branco do modelo se falhar no início
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        const lastMsg = lastIndex >= 0 ? updated[lastIndex] : null;
        if (lastMsg && lastMsg.role === "model" && !lastMsg.content) {
          updated.pop();
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSource = async (src: SourceArticle) => {
    setActiveArticle(src);
    if (!user) return;
    try {
      // Registra a visualização no histórico
      await addHistoryEntry(user.uid, {
        type: "view",
        knowledgeItemId: src.id,
      });
    } catch (err) {
      console.error("Erro ao registrar visualização:", err);
    }
  };

  const handleToggleFavorite = async (itemId: string) => {
    if (!user) return;
    try {
      const isFav = await toggleFavorite(user.uid, itemId);
      setFavIds((prev) => {
        const next = new Set(prev);
        if (isFav) {
          next.add(itemId);
        } else {
          next.delete(itemId);
        }
        return next;
      });
    } catch (err) {
      console.error(err);
      setError("Erro ao salvar favorito.");
    }
  };

  return (
    <div className="flex flex-col h-[650px] bg-white border border-slate-200 rounded-card shadow-sm overflow-hidden relative">
      {/* Banner de Disclaimer Legal */}
      <div className="bg-amber-50 border-b border-amber-100 p-3 text-xs text-amber-800 leading-relaxed flex flex-col gap-1">
        <p className="font-semibold">⚠️ Assistente de Orientação Clínica Educacional</p>
        <p>
          Este assistente responde estritamente com base em artigos validados de nossa base. Suas respostas têm finalidade puramente educativa e <strong>não constituem diagnósticos ou prescrições</strong>. Por privacidade, evite inserir dados pessoais identificáveis de crianças nas suas perguntas.
        </p>
      </div>

      {/* Fase 7 — Seletor de perfil da criança para personalizar as respostas */}
      {children.length > 0 && (
        <div className="border-b border-slate-200 bg-white px-4 py-2 flex items-center gap-2">
          <label htmlFor="chat-child-select" className="text-xs font-medium text-slate-500 shrink-0">
            Personalizar para:
          </label>
          <Select
            id="chat-child-select"
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="w-auto text-xs py-1"
          >
            <option value="">Sem personalização</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name} ({formatAgeLabel(child.birthDate)})
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Área de Histórico das Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3 max-w-md mx-auto my-auto">
            <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-bold">
              💡
            </div>
            <h4 className="text-base font-bold text-slate-800">Como posso ajudar hoje?</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              {"Faça perguntas sobre autismo e neurodesenvolvimento como: 'O que é ecolalia?', 'Como lidar com crises de rigidez?' ou 'Como posso incentivar o contato visual em casa?'."}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col max-w-[85%] ${
                msg.role === "user" ? "self-end items-end" : "self-start items-start"
              }`}
            >
              {/* Balão da Mensagem */}
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-none"
                    : "bg-white text-slate-850 border border-slate-200 shadow-sm rounded-bl-none whitespace-pre-wrap"
                }`}
              >
                {msg.content}
              </div>

              {/* Fontes / Referências associadas (apenas para a IA) */}
              {msg.role === "model" && msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-2 px-1 w-full">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Fontes de apoio consultadas:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.map((src) => (
                      <button
                        key={src.id}
                        onClick={() => handleOpenSource(src)}
                        className="inline-flex items-center text-left text-xs bg-indigo-50/70 hover:bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold rounded-lg px-2.5 py-1 transition-colors"
                      >
                        📖 {src.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Indicador de Carregamento / Digitação */}
        {isLoading && (
          <div className="self-start flex items-center gap-2 bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
            <span className="text-xs text-slate-400 animate-pulse font-medium">IA está formulando resposta</span>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce delay-75" />
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce delay-150" />
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce delay-300" />
            </div>
          </div>
        )}

        {error && (
          <Alert variant="error" className="my-2">
            {error}
          </Alert>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Caixa de Entrada e Envio */}
      <div className="border-t border-slate-200 p-4 bg-white">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua dúvida sobre desenvolvimento e autismo..."
            disabled={isLoading}
            className="flex-1 border-slate-300 focus:border-indigo-500"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5"
          >
            Enviar
          </Button>
        </form>
      </div>

      {/* Modal Lateral (Drawer) de Visualização do Artigo Clínico Completo */}
      {activeArticle && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50">
          <div className="w-[85%] md:w-[450px] bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Cabeçalho */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div className="flex flex-col gap-1.5 flex-1">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                  Ficha Clínica Validada
                </span>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    {activeArticle.title}
                  </h3>
                  {/* Botão de favoritar dentro do Drawer */}
                  <button
                    onClick={() => handleToggleFavorite(activeArticle.id)}
                    className={`transition-colors p-1 ${
                      favIds.has(activeArticle.id) ? "text-amber-400" : "text-slate-300 hover:text-amber-300"
                    }`}
                    title={favIds.has(activeArticle.id) ? "Remover dos favoritos" : "Salvar nos favoritos"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5.5 h-5.5">
                      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              <button
                onClick={() => setActiveArticle(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 select-none"
              >
                ✕
              </button>
            </div>

            {/* Badges e Faixa Etária */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${
                EVIDENCE_LEVEL_LABELS[activeArticle.evidenceLevel]?.color || "bg-slate-50 text-slate-700"
              }`}>
                {EVIDENCE_LEVEL_LABELS[activeArticle.evidenceLevel]?.label || activeArticle.evidenceLevel}
              </span>
              {activeArticle.ageRange && (
                <span className="bg-slate-100 text-slate-600 border border-slate-200 rounded-md px-2.5 py-0.5 text-xs font-medium">
                  Idade: {activeArticle.ageRange}
                </span>
              )}
            </div>

            {/* Resumo */}
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs text-slate-600 mb-4 leading-relaxed italic">
              <strong>Resumo:</strong> {activeArticle.summary}
            </div>

            {/* Conteúdo Completo */}
            <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed pb-8">
              {activeArticle.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
