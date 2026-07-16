"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, Button, Loading, EmptyState, Alert, PageHeader } from "@/components/ui";
import { listFavorites, toggleFavorite, type FavoriteWithItem } from "@/domains/favorites/service";
import { addHistoryEntry } from "@/domains/history/service";

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

export default function FavoritosPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteWithItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado para o Drawer lateral
  const [activeArticle, setActiveArticle] = useState<SourceArticle | null>(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const data = await listFavorites(user.uid);
        setFavorites(data);
      } catch (err: any) {
        console.error(err);
        setError("Não foi possível carregar a lista de favoritos.");
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading && user) {
      fetchFavorites();
    }
  }, [user, authLoading]);

  const handleRemoveFavorite = async (itemId: string) => {
    if (!user) return;
    try {
      // Remove do Firestore
      await toggleFavorite(user.uid, itemId);
      // Remove do estado local para feedback reativo imediato
      setFavorites((prev) => prev.filter((fav) => fav.knowledgeItemId !== itemId));
    } catch (err) {
      console.error(err);
      setError("Erro ao tentar remover o favorito.");
    }
  };

  const handleOpenArticle = async (article: SourceArticle) => {
    setActiveArticle(article);
    if (!user) return;
    try {
      // Registra a visualização no histórico
      await addHistoryEntry(user.uid, {
        type: "view",
        knowledgeItemId: article.id,
      });
    } catch (err) {
      console.error("Erro ao registrar visualização no histórico:", err);
    }
  };

  if (authLoading || (isLoading && user)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loading />
        <p className="text-sm font-medium text-slate-500">Carregando seus favoritos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full relative">
      <PageHeader
        title="Seus Favoritos"
        description="Acesse facilmente os artigos clínicos que você salvou."
      />

      {error && <Alert variant="error">{error}</Alert>}

      {favorites.length === 0 ? (
        <EmptyState
          title="Nenhum favorito salvo"
          description="Você ainda não salvou nenhum artigo. Utilize a busca na página inicial ou consulte o assistente de IA para encontrar orientações clínicas e clique na estrela para salvar."
        />
      ) : (
        <div className="grid gap-4">
          {favorites.map((fav) => {
            const item = fav.item;
            if (!item) return null;

            const evidence = EVIDENCE_LEVEL_LABELS[item.evidenceLevel] || {
              label: item.evidenceLevel,
              color: "bg-slate-50 text-slate-700",
            };

            return (
              <Card key={fav.id} className="hover:shadow-md transition-all duration-200 border-slate-200">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <h3 className="text-lg font-bold text-slate-900 leading-tight">
                        {item.title}
                      </h3>
                      {item.ageRange && (
                        <span className="text-xs text-slate-500 font-medium mt-0.5">
                          Faixa etária: {item.ageRange}
                        </span>
                      )}
                    </div>
                    {/* Botão de Estrela Amarela Preenchida */}
                    <button
                      onClick={() => handleRemoveFavorite(item.id)}
                      className="text-amber-400 hover:text-slate-350 transition-colors p-1"
                      title="Remover dos favoritos"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.summary}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${evidence.color}`}>
                        {evidence.label}
                      </span>
                    </div>

                    <Button
                      onClick={() => handleOpenArticle(item as SourceArticle)}
                      className="bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 font-semibold px-4 py-1.5 h-auto text-xs"
                    >
                      Ler Ficha Completa
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Drawer lateral de visualização da Ficha Completa */}
      {activeArticle && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50">
          <div className="w-[85%] md:w-[450px] bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                  Artigo Clínico Favoritado
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
