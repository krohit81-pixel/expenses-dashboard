import { z } from "zod";

export const userSettingsInputSchema = z.object({
  baseCurrency: z
    .string()
    .regex(
      /^[A-Z]{3}$/,
      "Use a 3-letter ISO 4217 currency code, e.g. USD or INR",
    ),
  timezone: z.string().min(1, "Timezone is required"),
});

export type UserSettingsInput = z.infer<typeof userSettingsInputSchema>;
