import { z } from "zod";
import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import {
  daySchema,
  hasValidDayCount,
  MAX_TRIP_DAYS,
  MIN_TRIP_DAYS,
  pointSchema,
} from "@/lib/services/itinerary-schema";

export const prerender = false;

// The save body is client-controlled, so unlike the lenient Gemini-side
// schema it caps text length and point count before anything hits the DB.
const MAX_POINT_NAME_LENGTH = 200;
const MAX_POINT_DESCRIPTION_LENGTH = 2000;
const MAX_POINTS_PER_DAY = 20;

const savePointSchema = pointSchema.extend({
  name: z.string().min(1).max(MAX_POINT_NAME_LENGTH),
  description: z.string().max(MAX_POINT_DESCRIPTION_LENGTH).optional(),
});

const saveRequestSchema = z.object({
  city: z.string().trim().min(1).max(100),
  day_count: z.number().int().min(MIN_TRIP_DAYS).max(MAX_TRIP_DAYS),
  days: z
    .array(daySchema.extend({ points: z.array(savePointSchema).min(1).max(MAX_POINTS_PER_DAY) }))
    .min(1)
    .max(MAX_TRIP_DAYS),
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

  const parsed = saveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid_input" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { city, day_count, days } = parsed.data;

  if (!hasValidDayCount({ days }, day_count)) {
    return new Response(JSON.stringify({ error: "invalid_input" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "supabase_not_configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = context.locals.user.id;

  try {
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({ user_id: userId, city, day_count })
      .select()
      .single();

    if (tripError) {
      return new Response(JSON.stringify({ error: "save_failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const pointsToInsert = days.flatMap((day) =>
      day.points.map((point, index) => ({
        trip_id: trip.id,
        // Overwritten server-side by the set_trip_points_user_id trigger; passed
        // only because the generated Insert type requires it non-optionally.
        user_id: userId,
        day_number: day.day_number,
        order_index: index,
        name: point.name,
        description: point.description,
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    );

    const { data: tripPoints, error: pointsError } = await supabase.from("trip_points").insert(pointsToInsert).select();

    if (pointsError) {
      // Best-effort cleanup so a failed save doesn't leave a trip with no
      // points (trips can't be deleted from the UI yet); errors are ignored
      // because the response is save_failed either way.
      await supabase.from("trips").delete().eq("id", trip.id);
      return new Response(JSON.stringify({ error: "save_failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ...trip, trip_points: tripPoints }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "unexpected_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "supabase_not_configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: trips, error } = await supabase
    .from("trips")
    .select("*, trip_points(*)")
    .eq("user_id", context.locals.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: "fetch_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(trips), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
