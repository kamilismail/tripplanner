import { z } from "zod";

/** Day-count bounds shared by the API schemas and the client-side form validation. */
export const MIN_TRIP_DAYS = 1;
export const MAX_TRIP_DAYS = 14;

/**
 * Single source of truth for the itinerary shape returned by Gemini.
 *
 * The same field list backs both:
 * - `itinerarySchema` (zod): validates whatever comes back from Gemini.
 * - `itineraryResponseSchema` (plain object): Gemini's own schema dialect,
 *   passed as `generationConfig.responseSchema` to constrain what Gemini
 *   generates in the first place.
 *
 * Keeping both in this one file means the request contract and the
 * response validation can never drift apart silently.
 */

const pointSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const daySchema = z.object({
  day_number: z.number().int().min(1),
  points: z.array(pointSchema).min(1),
});

export const itinerarySchema = z.object({
  days: z.array(daySchema).min(1),
});

export type ItineraryPlan = z.infer<typeof itinerarySchema>;
export type ItineraryDay = z.infer<typeof daySchema>;
export type ItineraryPoint = z.infer<typeof pointSchema>;

/**
 * Raw Gemini response envelope: `itinerarySchema`'s shape plus a
 * `city_recognized` flag the prompt asks Gemini to self-report. Lets
 * `generateItinerary` reject an obviously nonsense/nonexistent city before
 * it ever reaches `ItineraryPlan` — a placeholder `days` entry still
 * satisfies `minItems: 1` when `city_recognized` is false.
 */
export const geminiRawItineraryResponseSchema = itinerarySchema.extend({
  city_recognized: z.boolean(),
});

export type GeminiRawItineraryResponse = z.infer<typeof geminiRawItineraryResponseSchema>;

/**
 * Gemini's `responseSchema` dialect: plain `type`/`properties`/`required`
 * objects, no zod-specific keywords. Mirrors `geminiRawItineraryResponseSchema`
 * field-for-field.
 */
export const itineraryResponseSchema = {
  type: "object",
  properties: {
    city_recognized: {
      type: "boolean",
      description:
        "false if the requested city is not a real, recognizable geographic place (city, town, or region); true otherwise.",
    },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          day_number: { type: "integer", minimum: 1 },
          points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                latitude: { type: "number", minimum: -90, maximum: 90 },
                longitude: { type: "number", minimum: -180, maximum: 180 },
              },
              required: ["name"],
            },
            minItems: 1,
          },
        },
        required: ["day_number", "points"],
      },
      minItems: 1,
    },
  },
  required: ["city_recognized", "days"],
};

/**
 * Checks that `plan.days` covers `1..dayCount` exactly once each, with no
 * gaps or duplicates. Schema validation alone can't express this because it
 * depends on the caller-supplied `dayCount`, not just the shape of the data.
 */
export function hasValidDayCount(plan: ItineraryPlan, dayCount: number): boolean {
  if (plan.days.length !== dayCount) {
    return false;
  }
  const dayNumbers = new Set(plan.days.map((day) => day.day_number));
  if (dayNumbers.size !== dayCount) {
    return false;
  }
  for (let day = 1; day <= dayCount; day += 1) {
    if (!dayNumbers.has(day)) {
      return false;
    }
  }
  return true;
}
