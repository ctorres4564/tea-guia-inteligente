/**
 * Nomes das coleções do Firestore centralizados para evitar strings mágicas
 * espalhadas pelo código.
 */
export const FIRESTORE_COLLECTIONS = {
  profiles: "profiles",
  categories: "categories",
  knowledgeItems: "knowledgeItems",
  knowledgeSources: "knowledgeSources",
  favorites: "favorites",
  history: "history",
} as const;
