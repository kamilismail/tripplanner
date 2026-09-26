import { z } from "zod";
import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { itinerarySchema, hasValidDayCount } from "@/lib/services/itinerary-schema";

export const prerender = false;

const saveRequestSchema = itinerarySchema.extend({
  city: z.string().min(1),
  day_count: z.number().int().min(1).max(14),
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
    return new Response(JSON.stringify({ error: "save_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ...trip, trip_points: tripPoints }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
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
