import { z } from "zod";

/**
 * Modelagem de `favorites/{userId}/items/{favoriteId}`.
 * Estrutura documentada nesta fase; a interface de favoritos será implementada
 * em uma fase futura (ver ROADMAP.md).
 */
export const favoriteSchema = z.object({
  knowledgeItemId: z.string().min(1),
  createdAt: z.unknown(),
});
export type Favorite = z.infer<typeof favoriteSchema>;
