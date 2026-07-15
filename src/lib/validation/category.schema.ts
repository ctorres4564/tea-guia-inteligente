import { z } from "zod";

export const categoryStatusSchema = z.enum(["draft", "published", "archived"]);
export type CategoryStatus = z.infer<typeof categoryStatusSchema>;

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug deve estar em kebab-case"),
  description: z.string().trim().max(500).optional().default(""),
  parentId: z.string().nullable().optional(),
  status: categoryStatusSchema,
  displayOrder: z.number().int().nonnegative().default(0),
  createdAt: z.unknown(),
  updatedAt: z.unknown(),
});
export type Category = z.infer<typeof categorySchema>;
