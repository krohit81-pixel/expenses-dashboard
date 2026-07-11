import { z } from "zod";

export const createInstitutionInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  website: z.url().nullable().optional(),
});

export type CreateInstitutionInput = z.infer<
  typeof createInstitutionInputSchema
>;
