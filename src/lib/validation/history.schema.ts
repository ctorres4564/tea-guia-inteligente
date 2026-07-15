import { z } from "zod";

export const historyTypeSchema = z.enum(["question", "search", "view"]);
export type HistoryType = z.infer<typeof historyTypeSchema>;

/**
 * Modelagem de `history/{userId}/items/{historyId}`.
 * Estrutura documentada nesta fase; o recurso completo será implementado
 * em uma fase futura (ver ROADMAP.md).
 */
export const historySchema = z.object({
  type: historyTypeSchema,
  query: z.string().trim().max(500).optional(),
  knowledgeItemId: z.string().nullable().optional(),
  createdAt: z.unknown(),
});
export type History = z.infer<typeof historySchema>;
