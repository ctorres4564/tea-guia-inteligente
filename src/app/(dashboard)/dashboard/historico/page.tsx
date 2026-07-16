"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Card, Button, Loading, EmptyState, Alert, PageHeader } from "@/components/ui";
import { listHistory, type HistoryWithItem } from "@/domains/history/service";

interface SourceArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  evidenceLevel: "low" | "moderate" | "high" | "expert_consensus";
  ageRange?: string;
}

const EVIDENCE_LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "Evidência Baixa", color: "bg-red-50 text-red-700 border-red-200" },
  moderate: { label: "Evidência Moderada", color: "bg-amber-50 text-amber-700 border-amber-200" },
  high: { label: "Evidência Alta", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expert_consensus: { label: "Consenso de Especialistas", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

function formatRelativeDate(dateInput: any): string {
  if (!dateInput) return "—";
  
  const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Agora mesmo";
  if (diffMins < 60) return `Há ${diffMins} min`;
  if (diffHours < 24) return `Há ${diffHours} h`;
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `Há ${diffDays} dias`;
  
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

export default function HistoricoPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [history, setHistory] = useState<HistoryWithItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Estado para o Drawer lateral
  const [activeArticle, setActiveArticle] = useState<SourceArticle | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const data = await listHistory(user.uid);
        setHistory(data);
      } catch (err: any) {
        console.error(err);
        setError("Não foi possível carregar o histórico de interações.");
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading && user) {
      fetchHistory();
    }
  }, [user, authLoading]);

  const handleRefaceSearch = (queryStr: string) => {
    // Redireciona para o Dashboard passando o parâmetro q
    router.push(`/dashboard?q=${encodeURIComponent(queryStr)}`);
  };

  const handleRefaceQuestion = (queryStr: string) => {
    // Redireciona para o Chat passando o parâmetro q
    router.push(`/dashboard/chat?q=${encodeURIComponent(queryStr)}`);
  };

  if (authLoading || (isLoading && user)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loading />
        <p className="text-sm font-medium text-slate-500">Carregando histórico de navegação...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full relative">
      <PageHeader
        title="Seu Histórico"
        description="Acompanhe suas últimas interações, pesquisas e perguntas feitas ao orientador clínico."
      />

      {error && <Alert variant="error">{error}</Alert>}

      {history.length === 0 ? (
        <EmptyState
          title="Histórico vazio"
          description="Você ainda não possui interações registradas. Comece realizando pesquisas no dashboard ou tirando dúvidas no chat de IA."
        />
      ) : (
        <div className="flex flex-col gap-4 relative pl-6 border-l border-slate-200 ml-4 pt-2">
          {history.map((hist) => {
            const timeLabel = formatRelativeDate(hist.createdAt);

            return (
              <div key={hist.id} className="relative mb-2">
                {/* Marcador na Timeline */}
                <div className={`absolute -left-[35px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-slate-50 flex items-center justify-center text-[10px] ${
                  hist.type === "search" ? "bg-amber-400" : hist.type === "question" ? "bg-indigo-600" : "bg-emerald-500"
                }`} />

                <Card className="border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                          hist.type === "search" ? "bg-amber-50 text-amber-700" : hist.type === "question" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {hist.type === "search" ? "🔍 Busca" : hist.type === "question" ? "💬 Pergunta" : "📄 Artigo visto"}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {timeLabel}
                        </span>
                      </div>

                      {/* Conteúdo do Histórico */}
                      {hist.type === "search" && hist.query && (
                        <p className="text-sm font-bold text-slate-800">
                          Pesquisou por: &quot;{hist.query}&quot;
                        </p>
                      )}

                      {hist.type === "question" && hist.query && (
                        <p className="text-sm font-medium text-slate-700 italic">
                          Perguntou: &quot;{hist.query}&quot;
                        </p>
                      )}

                      {hist.type === "view" && hist.item && (
                        <p className="text-sm font-bold text-slate-800">
                          Visualizou a ficha: {hist.item.title}
                        </p>
                      )}
                      {hist.type === "view" && !hist.item && (
                        <p className="text-sm text-slate-400 italic">
                          Artigo visualizado (conteúdo não disponível)
                        </p>
                      )}
                    </div>

                    {/* Botões de Ação na Timeline */}
                    <div>
                      {hist.type === "search" && hist.query && (
                        <Button
                          onClick={() => handleRefaceSearch(hist.query!)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold px-3 py-1 text-xs h-auto"
                        >
                          Refazer busca
                        </Button>
                      )}

                      {hist.type === "question" && hist.query && (
                        <Button
                          onClick={() => handleRefaceQuestion(hist.query!)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold px-3 py-1 text-xs h-auto"
                        >
                          Refazer pergunta
                        </Button>
                      )}

                      {hist.type === "view" && hist.item && (
                        <Button
                          onClick={() => setActiveArticle(hist.item as SourceArticle)}
                          className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 font-semibold px-3 py-1 text-xs h-auto"
                        >
                          Ver novamente
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer lateral de visualização do Artigo completo (caso clique em ver novamente no histórico) */}
      {activeArticle && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50">
          <div className="w-[85%] md:w-[450px] bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                  Artigo Clínico Re-visualizado
                </span>
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  {activeArticle.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveArticle(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

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

            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs text-slate-600 mb-4 leading-relaxed italic">
              <strong>Resumo:</strong> {activeArticle.summary}
            </div>

            <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed pb-8">
              {activeArticle.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
