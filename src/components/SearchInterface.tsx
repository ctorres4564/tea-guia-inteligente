"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Card, Button, Input, Select, Loading, EmptyState, Alert } from "@/components/ui";
import { toggleFavorite, listFavorites } from "@/domains/favorites/service";
import { addHistoryEntry } from "@/domains/history/service";

/**
 * Converte o score de similaridade vetorial (0–1) em rótulo qualitativo.
 * Evita que o usuário interprete a correspondência semântica como certeza clínica.
 */
function getSemanticMatchLabel(similarity: number): { label: string; color: string } {
  if (similarity >= 0.85) return { label: "Alta correspondência semântica", color: "bg-indigo-50 border-indigo-100 text-indigo-700" };
  if (similarity >= 0.75) return { label: "Boa correspondência semântica", color: "bg-blue-50 border-blue-100 text-blue-700" };
  return { label: "Razoável correspondência semântica", color: "bg-slate-50 border-slate-200 text-slate-600" };
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface SearchResultItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  evidenceLevel: "low" | "moderate" | "high" | "expert_consensus";
  targetAudience: string[];
  ageRange?: string;
  tags?: string[];
  similarity: number;
}

interface SearchInterfaceProps {
  categories: Category[];
}

const EVIDENCE_LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "Evidência Baixa", color: "bg-red-50 text-red-700 border-red-200" },
  moderate: { label: "Evidência Moderada", color: "bg-amber-50 text-amber-700 border-amber-200" },
  high: { label: "Evidência Alta", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expert_consensus: { label: "Consenso de Especialistas", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

const AUDIENCE_LABELS: Record<string, string> = {
  family: "Pais/Família",
  educator: "Educador(a)",
  professional: "Profissional",
  general: "Público Geral",
};

export function SearchInterface({ categories }: SearchInterfaceProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Estados para Favoritos e Visualização Completa
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [activeArticle, setActiveArticle] = useState<SearchResultItem | null>(null);

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

  // Executa busca com termo
  const executeSearch = useCallback(async (searchTerm: string) => {
    setIsLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: searchTerm.trim(),
          categoryId: categoryId || undefined,
          targetAudience: targetAudience || undefined,
          ageRange: ageRange || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ocorreu um erro ao realizar a busca.");
      }

      const searchResults = data.results || [];
      setResults(searchResults);

      // Registra a pesquisa no histórico
      if (user && searchResults.length > 0) {
        await addHistoryEntry(user.uid, {
          type: "search",
          query: searchTerm.trim(),
        });
      }
    } catch (err: any) {
      setError(err.message || "Erro de conexão com o servidor.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, categoryId, targetAudience, ageRange]);

  // Dispara a busca automática se houver o parâmetro 'q' na URL
  useEffect(() => {
    const queryParam = searchParams.get("q");
    if (queryParam && queryParam.trim().length >= 2) {
      setQ(queryParam);
      executeSearch(queryParam);
    }
  }, [searchParams, executeSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim() || q.trim().length < 2) {
      setError("Digite pelo menos 2 caracteres para realizar a busca.");
      return;
    }
    executeSearch(q);
  };

  const handleClear = () => {
    setQ("");
    setCategoryId("");
    setTargetAudience("");
    setAgeRange("");
    setResults([]);
    setError(null);
    setSearched(false);
  };

  const handleToggleFavorite = async (itemId: string) => {
    if (!user) {
      setError("É necessário estar autenticado para salvar favoritos.");
      return;
    }

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
      setError("Erro ao tentar salvar favorito.");
    }
  };

  const handleOpenArticle = async (item: SearchResultItem) => {
    setActiveArticle(item);
    if (!user) return;
    try {
      // Registra a visualização no histórico
      await addHistoryEntry(user.uid, {
        type: "view",
        knowledgeItemId: item.id,
      });
    } catch (err) {
      console.error("Erro ao registrar visualização no histórico:", err);
    }
  };

  return (
    <div className="flex flex-col gap-6 relative">
      {/* Barra de busca e filtros */}
      <Card className="shadow-sm border-slate-200">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Busque por sintomas, comportamentos ou orientações (Ex: ecolalia, contato visual)..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full text-base h-11 border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading} className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                {isLoading ? "Buscando..." : "Buscar com IA"}
              </Button>
              {searched && (
                <Button type="button" variant="secondary" onClick={handleClear} disabled={isLoading} className="h-11">
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Filtros Avançados */}
          <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Categoria
              </label>
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border-slate-300 focus:border-indigo-500"
              >
                <option value="">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Público-alvo
              </label>
              <Select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full border-slate-300 focus:border-indigo-500"
              >
                <option value="">Todos os públicos</option>
                <option value="family">Pais/Família</option>
                <option value="educator">Educador(a)</option>
                <option value="professional">Profissional</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Faixa Etária
              </label>
              <Input
                placeholder="Ex: 4 anos, todas..."
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
                className="w-full border-slate-300 focus:border-indigo-500 h-10"
              />
            </div>
          </div>
        </form>
      </Card>

      {/* Exibição de erros */}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Resultados da busca */}
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loading />
            <p className="text-sm font-medium text-slate-500 animate-pulse">
              Interpretando intenção e buscando dados clínicos...
            </p>
          </div>
        ) : searched ? (
          results.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  Resultados Encontrados ({results.length})
                </h3>
                <span className="text-xs text-slate-400">
                  Ordenado por relevância semântica
                </span>
              </div>

              <div className="grid gap-4">
                {results.map((item) => {
                  const evidence = EVIDENCE_LEVEL_LABELS[item.evidenceLevel] || {
                    label: item.evidenceLevel,
                    color: "bg-slate-50 text-slate-700 border-slate-200",
                  };

                  const semanticMatch = getSemanticMatchLabel(item.similarity);
                  const isFavorited = favIds.has(item.id);

                  return (
                    <Card key={item.id} className="hover:border-indigo-200 hover:shadow-md transition-all duration-200 border-slate-200">
                      <div className="flex flex-col gap-3">
                        {/* Cabeçalho do Card */}
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-bold text-slate-900 leading-tight">
                                {item.title}
                              </h4>
                              {/* Botão de Estrela de Favorito */}
                              <button
                                onClick={() => handleToggleFavorite(item.id)}
                                className={`transition-colors p-1 ${
                                  isFavorited ? "text-amber-400" : "text-slate-300 hover:text-amber-300"
                                }`}
                                title={isFavorited ? "Remover dos favoritos" : "Salvar nos favoritos"}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5.5 h-5.5">
                                  <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                            {item.ageRange && (
                              <span className="text-xs text-slate-500 font-medium mt-0.5">
                                Faixa etária recomendada: {item.ageRange}
                              </span>
                            )}
                          </div>

                          {/* Relevância com progress bar em miniatura */}
                          <div
                            className={`flex items-center gap-2 border rounded-full px-3 py-1 text-xs font-semibold ${semanticMatch.color}`}
                            title="Correspondência semântica indica quão relacionado este conteúdo está à sua pesquisa — não representa certeza clínica."
                          >
                            <span>{semanticMatch.label}</span>
                          </div>
                        </div>

                        {/* Resumo/Descrição */}
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {item.summary}
                        </p>

                        {/* Badges e rodapé */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Nível de Evidência */}
                            <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${evidence.color}`}>
                              {evidence.label}
                            </span>

                            {/* Público Alvo */}
                            {item.targetAudience.map((aud) => (
                              <span key={aud} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
                                {AUDIENCE_LABELS[aud] || aud}
                              </span>
                            ))}
                          </div>

                          <Button
                            onClick={() => handleOpenArticle(item)}
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
            </div>
          ) : (
            <EmptyState
              title="Nenhum conteúdo correspondente"
              description="Não encontramos artigos clínicos com relevância suficiente para a sua pesquisa. Tente descrever o sintoma ou comportamento de forma diferente."
            />
          )
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm">
            Digite um termo de pesquisa acima para buscar orientações clínicas baseadas em evidências.
          </div>
        )}
      </div>

      {/* Drawer lateral de visualização do Artigo completo */}
      {activeArticle && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50">
          <div className="w-[85%] md:w-[450px] bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                  Artigo Clínico Completo
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
