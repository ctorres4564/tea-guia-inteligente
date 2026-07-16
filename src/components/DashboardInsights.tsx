"use client";

import React, { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { Card, Button, Loading } from "@/components/ui";
import { listFavorites, toggleFavorite } from "@/domains/favorites/service";
import { useAuth } from "@/hooks/useAuth";

interface Recommendation {
  id: string;
  title: string;
  summary: string;
  content: string;
  evidenceLevel: "low" | "moderate" | "high" | "expert_consensus";
  targetAudience: string[];
  ageRange?: string;
  similarity: number;
  recommendationReason: string;
}

interface SystemNotification {
  id: string;
  type: string;
  title: string;
  summary: string;
  contentId: string;
  contentSlug: string;
  createdAt: any;
}

const EVIDENCE_LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: "Evidência Baixa", color: "bg-red-50 text-red-700 border-red-200" },
  moderate: { label: "Evidência Moderada", color: "bg-amber-50 text-amber-700 border-amber-200" },
  high: { label: "Evidência Alta", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expert_consensus: { label: "Consenso de Especialistas", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

export function DashboardInsights() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [hasProfile, setHasProfile] = useState(false);
  const [recsLoading, setRecsLoading] = useState(true);

  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());

  // Modal de Artigo Ativo
  const [activeArticle, setActiveArticle] = useState<Recommendation | null>(null);
  const [relatedItems, setRelatedItems] = useState<Recommendation[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());

  // Carrega favoritos
  useEffect(() => {
    if (!user) return;
    listFavorites(user.uid)
      .then((favs) => setFavIds(new Set(favs.map((f) => f.knowledgeItemId))))
      .catch((err) => console.error("Erro ao carregar favoritos:", err));
  }, [user]);

  // Favoritar / desfavoritar
  const handleToggleFavorite = async (itemId: string) => {
    if (!user) return;
    try {
      const isFav = await toggleFavorite(user.uid, itemId);
      setFavIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(itemId);
        else next.delete(itemId);
        return next;
      });
    } catch (err) {
      console.error("Erro ao favoritar:", err);
    }
  };

  // Carrega Recomendações
  useEffect(() => {
    const fetchRecs = async () => {
      try {
        const res = await fetch("/api/knowledge/recommendations");
        if (res.ok) {
          const data = await res.json();
          setRecommendations(data.results || []);
          setHasProfile(data.hasProfile ?? false);
        }
      } catch (err) {
        console.error("Erro ao buscar recomendações:", err);
      } finally {
        setRecsLoading(false);
      }
    };

    fetchRecs();
  }, []);

  // Escuta Notificações em tempo real
  useEffect(() => {
    if (!user) return;

    // Carrega IDs de notificações lidas do localStorage
    try {
      const stored = localStorage.getItem(`read_notifs_${user.uid}`);
      if (stored) {
        setReadNotifIds(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.error(e);
    }

    const firestore = getFirebaseFirestore();
    const q = query(
      collection(firestore, "notifications"),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SystemNotification[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          type: data.type || "new_content",
          title: data.title || "Novidade",
          summary: data.summary || "",
          contentId: data.contentId || "",
          contentSlug: data.contentSlug || "",
          createdAt: data.createdAt,
        };
      });
      setNotifications(list);
    }, (err) => {
      console.error("Erro ao escutar notificações:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // Carrega relacionados do artigo ativo
  useEffect(() => {
    if (!activeArticle) {
      setRelatedItems([]);
      return;
    }

    const loadRelated = async () => {
      setRelatedLoading(true);
      try {
        const res = await fetch("/api/knowledge/related", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: activeArticle.id }),
        });
        if (res.ok) {
          const data = await res.json();
          setRelatedItems(data.results || []);
        }
      } catch (err) {
        console.error("Erro ao carregar relacionados no dashboard:", err);
      } finally {
        setRelatedLoading(false);
      }
    };

    loadRelated();
  }, [activeArticle]);

  const markNotificationAsRead = (id: string) => {
    if (!user) return;
    setReadNotifIds((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(`read_notifs_${user.uid}`, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  const handleOpenArticleFromNotification = async (notif: SystemNotification) => {
    markNotificationAsRead(notif.id);
    if (!notif.contentId) return;

    // Busca o conteúdo clínico para abrir o drawer
    try {
      const docSnap = await fetch(`/api/knowledge/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: notif.summary }), // busca pelo título exato
      });
      if (docSnap.ok) {
        const d = await docSnap.json();
        const item = d.results?.[0];
        if (item) {
          setActiveArticle(item);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Coluna de Recomendações (2/3 da largura) */}
      <div className="md:col-span-2 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Recomendado para Você</h3>
          {hasProfile && (
            <span className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
              Personalizado via Perfil
            </span>
          )}
        </div>

        {recsLoading ? (
          <Card className="flex items-center justify-center py-10">
            <Loading label="Carregando recomendações..." />
          </Card>
        ) : recommendations.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {recommendations.map((item) => (
              <Card key={item.id} className="flex flex-col justify-between hover:shadow-md transition-all duration-200 border-slate-200">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                      EVIDENCE_LEVEL_LABELS[item.evidenceLevel]?.color || "bg-slate-50 text-slate-700"
                    }`}>
                      {EVIDENCE_LEVEL_LABELS[item.evidenceLevel]?.label || item.evidenceLevel}
                    </span>
                    <button
                      onClick={() => handleToggleFavorite(item.id)}
                      className={`transition-colors p-0.5 ${
                        favIds.has(item.id) ? "text-amber-400" : "text-slate-300 hover:text-amber-300"
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <h4 className="font-bold text-slate-900 leading-tight text-sm line-clamp-2">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {item.summary}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-3 flex flex-col gap-2">
                  <p className="text-[10px] text-slate-500 italic font-medium leading-tight">
                    {item.recommendationReason}
                  </p>
                  <Button
                    onClick={() => setActiveArticle(item)}
                    className="w-full text-xs font-semibold py-1 h-auto bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 mt-1"
                  >
                    Ler Ficha Completa
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center text-xs text-slate-500 border-slate-200">
            Nenhuma recomendação disponível no momento.
          </Card>
        )}
      </div>

      {/* Coluna de Notificações / Novidades (1/3 da largura) */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold text-slate-800">Novidades e Alertas</h3>

        {notifications.length > 0 ? (
          <div className="flex flex-col gap-3">
            {notifications.map((notif) => {
              const isUnread = !readNotifIds.has(notif.id);
              return (
                <div
                  key={notif.id}
                  onClick={() => handleOpenArticleFromNotification(notif)}
                  className={`relative cursor-pointer border rounded-xl p-3.5 flex flex-col gap-1.5 transition-all duration-200 ${
                    isUnread
                      ? "bg-indigo-50/40 border-indigo-100 hover:bg-indigo-50/60 shadow-xs"
                      : "bg-white border-slate-100 hover:border-slate-200"
                  }`}
                >
                  {isUnread && (
                    <span className="absolute top-3.5 right-3.5 h-2 w-2 rounded-full bg-indigo-600" title="Não lido"></span>
                  )}
                  <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-600">
                    Novo Conteúdo
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug pr-3">
                    {notif.title}
                  </h4>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {notif.summary}
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {notif.createdAt ? new Date(notif.createdAt.seconds * 1000).toLocaleDateString("pt-BR") : ""}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="p-6 text-center text-xs text-slate-400 border-slate-200">
            Sem novos alertas no momento.
          </Card>
        )}
      </div>

      {/* Drawer lateral de visualização do Artigo completo (Copiado da SearchInterface para consistência premium) */}
      {activeArticle && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50">
          <div className="w-[85%] md:w-[450px] bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div className="flex flex-col gap-1.5 flex-1">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                  Artigo Clínico Recomendado
                </span>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    {activeArticle.title}
                  </h3>
                  <button
                    onClick={() => handleToggleFavorite(activeArticle.id)}
                    className={`transition-colors p-1 ${
                      favIds.has(activeArticle.id) ? "text-amber-400" : "text-slate-300 hover:text-amber-300"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
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

            <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed pb-4 border-b border-slate-100">
              {activeArticle.content}
            </div>

            {/* Conteúdos Relacionados */}
            <div className="pt-6 pb-8">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                Conteúdos Relacionados
              </h4>
              {relatedLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                </div>
              ) : relatedItems.length > 0 ? (
                <div className="grid gap-3">
                  {relatedItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setActiveArticle(item);
                        const drawerElement = document.querySelector(".animate-in");
                        if (drawerElement) {
                          drawerElement.scrollTop = 0;
                        }
                      }}
                      className="group cursor-pointer rounded-lg border border-slate-100 bg-slate-50/50 p-3 hover:bg-indigo-50/30 hover:border-indigo-100 transition-all duration-200"
                    >
                      <h5 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                        {item.title}
                      </h5>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {item.summary}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Nenhum conteúdo clínico relacionado encontrado.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
