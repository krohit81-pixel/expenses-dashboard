import { z } from "zod";

/**
 * A trip's travellers, as free-text names (see the migration comment on
 * finance.trips.traveler_names for why this is an array of strings, not
 * a FK). Trimmed, deduplicated, at least one required — a trip with zero
 * travellers tagged isn't useful on the calendar (nothing to show in the
 * avatar stack, nothing to filter by).
 */
const zTravelerNames = z
  .array(z.string().trim().min(1).max(60))
  .min(1, "Tag at least one traveller")
  .transform((names) => Array.from(new Set(names)));

const baseTripFields = z.object({
  destination: z.string().trim().min(1, "Destination is required").max(200),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  flight: z.string().trim().max(60).nullable().optional(),
  travelerNames: zTravelerNames,
  notes: z.string().trim().max(1000).nullable().optional(),
});

function refineDateOrder<T extends { startDate: string; endDate: string }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  if (value.endDate < value.startDate) {
    ctx.addIssue({
      code: "custom",
      message: "Return date cannot be before the departure date",
      path: ["endDate"],
    });
  }
}

export const createTripInputSchema =
  baseTripFields.superRefine(refineDateOrder);
export type CreateTripInput = z.infer<typeof createTripInputSchema>;

export const updateTripInputSchema = baseTripFields
  .extend({ id: z.uuid() })
  .superRefine(refineDateOrder);
export type UpdateTripInput = z.infer<typeof updateTripInputSchema>;
