import { z } from "zod";
import { GEMINI_API_KEY } from "astro:env/server";
import {
  geminiRawItineraryResponseSchema,
  hasValidDayCount,
  itineraryResponseSchema,
  type ItineraryPlan,
} from "./itinerary-schema";

const geminiEnvelopeSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional() })).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent";

/**
 * Distinguishable failure mode for `generateItinerary`, so callers (the API
 * routes in Phase 2) can map every failure to the same "generation failed"
 * response without leaking raw Gemini errors to the client.
 *
 * - `upstream`: the HTTP call itself failed (non-2xx, network error, timeout).
 * - `invalid_response`: Gemini answered 200 but the payload was missing,
 *   blocked, malformed JSON, or failed schema/semantic validation.
 */
export class ItineraryGenerationError extends Error {
  cause: "upstream" | "invalid_response";

  constructor(message: string, cause: "upstream" | "invalid_response") {
    super(message);
    this.name = "ItineraryGenerationError";
    this.cause = cause;
  }
}

function extractCandidateText(body: unknown): string | undefined {
  const parsed = geminiEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data.candidates?.[0]?.content?.parts?.[0]?.text;
}

function buildPrompt(city: string, dayCount: number): string {
  return (
    `Create a detailed ${dayCount}-day travel itinerary for ${city}. ` +
    `Group points of interest by day, numbering days 1 through ${dayCount} with no gaps or repeats. ` +
    `For each point of interest, include its name and, when known, a short description and its latitude/longitude. ` +
    `Write the "name" and "description" fields in Polish. ` +
    `Set "city_recognized" to false if "${city}" is not a real, recognizable geographic place (city, town, or region) ` +
    `that actually exists — do not invent a place for it. When "city_recognized" is false, still return exactly one ` +
    `day with one placeholder point so the response stays schema-valid.`
  );
}

export async function generateItinerary(city: string, dayCount: number): Promise<ItineraryPlan> {
  let response: Response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY ?? "",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(city, dayCount) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: itineraryResponseSchema,
        },
      }),
    });
  } catch {
    throw new ItineraryGenerationError("Failed to reach the Gemini API.", "upstream");
  }

  if (!response.ok) {
    throw new ItineraryGenerationError(`Gemini API returned HTTP ${response.status}.`, "upstream");
  }

  const body: unknown = await response.json();

  // Gemini can return HTTP 200 with no usable candidate — e.g. a
  // safety-filter block (`promptFeedback.blockReason`) or a candidate whose
  // `finishReason` is "SAFETY"/"RECITATION"/"OTHER" instead of "STOP" — which
  // is not an HTTP failure. Guard before touching nested properties so this
  // can't throw an unhandled TypeError.
  const text = extractCandidateText(body);
  if (typeof text !== "string" || text.length === 0) {
    throw new ItineraryGenerationError("Gemini returned no usable candidate.", "invalid_response");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new ItineraryGenerationError("Gemini response was not valid JSON.", "invalid_response");
  }

  const result = geminiRawItineraryResponseSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new ItineraryGenerationError("Gemini response did not match the itinerary schema.", "invalid_response");
  }

  if (!result.data.city_recognized) {
    throw new ItineraryGenerationError(`Gemini did not recognize "${city}" as a real place.`, "invalid_response");
  }

  const plan: ItineraryPlan = { days: result.data.days };

  // Schema-valid but semantically wrong (e.g. wrong day count, or day
  // numbers that skip/repeat) is still rejected.
  if (!hasValidDayCount(plan, dayCount)) {
    throw new ItineraryGenerationError(
      "Gemini response day count/numbering did not match the request.",
      "invalid_response",
    );
  }

  return plan;
}
