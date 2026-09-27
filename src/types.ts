import type { Database } from "@/db/database.types";
import type { ItineraryDay } from "@/lib/services/itinerary-schema";

export type Trip = Database["public"]["Tables"]["trips"]["Row"];
export type TripPoint = Database["public"]["Tables"]["trip_points"]["Row"];

/** A saved trip with its points, as returned by `GET /api/trips` (points are unordered). */
export type TripWithPoints = Trip & { trip_points: TripPoint[] };

/** Body of `POST /api/trips/generate`. */
export interface GenerateTripRequest {
  city: string;
  day_count: number;
}

/** 200 response of `POST /api/trips/generate`; also the body of `POST /api/trips`. */
export interface GeneratedTripPlan extends GenerateTripRequest {
  days: ItineraryDay[];
}

/** Error envelope returned by the trip API routes. */
export interface ApiErrorResponse {
  error: string;
}
