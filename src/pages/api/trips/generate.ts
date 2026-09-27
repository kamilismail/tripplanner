import { z } from "zod";
import type { APIRoute } from "astro";
import { generateItinerary, ItineraryGenerationError } from "@/lib/services/gemini";
import { MAX_TRIP_DAYS, MIN_TRIP_DAYS } from "@/lib/services/itinerary-schema";

export const prerender = false;

const generateRequestSchema = z.object({
  city: z.string().trim().min(1).max(100),
  day_count: z.number().int().min(MIN_TRIP_DAYS).max(MAX_TRIP_DAYS),
});

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid_input" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { city, day_count } = parsed.data;

  try {
    const plan = await generateItinerary(city, day_count);
    return new Response(JSON.stringify({ city, day_count, days: plan.days }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ItineraryGenerationError) {
      return new Response(JSON.stringify({ error: "generation_failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "unexpected_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
