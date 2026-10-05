import { z } from "zod";

export const retentionActionSchema = z.enum([
  "prioritize_human_contact",
  "offer_rebooking",
  "remind_pending_package",
  "monitor",
  "human_review",
]);

export const retentionUrgencyLevelSchema = z.enum([
  "none",
  "low",
  "moderate",
  "high",
  "uncertain",
]);

export const retentionAdviceSchema = z.object({
  status: z.enum(["suggested", "review"]),
  action: retentionActionSchema,
  actionLabel: z.string().min(1).max(120),
  description: z.string().min(1).max(600),
  urgencyLevel: retentionUrgencyLevelSchema,
  confidence: z.number().min(0).max(1),
  evidenceSufficiency: z.number().min(0).max(1),
  model: z.string().min(1).max(80),
  evaluatedAt: z.string().datetime(),
  automaticAction: z.literal(false),
});

export type RetentionAdvice = z.infer<typeof retentionAdviceSchema>;

export function parseRetentionAdvice(payload: unknown): RetentionAdvice {
  return retentionAdviceSchema.parse(payload);
}
