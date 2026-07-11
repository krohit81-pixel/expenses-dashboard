import { z } from "zod";

export const createCategoryInputSchema = z.object({
  kind: z.enum(["income", "expense"]),
  name: z.string().trim().min(1, "Name is required").max(100),
  parentId: z.uuid().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;
