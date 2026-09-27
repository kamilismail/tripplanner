import { useCallback, useState } from "react";
import { MAX_TRIP_DAYS, MIN_TRIP_DAYS } from "@/lib/services/itinerary-schema";
import type { GenerateTripRequest } from "@/types";

function parseDayCount(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= MIN_TRIP_DAYS && value <= MAX_TRIP_DAYS ? value : null;
}

/**
 * Controlled city/day-count fields plus the client-side validation that lets
 * the form disable its submit button before an avoidable round trip.
 */
export function useTripGenerationForm(initial?: GenerateTripRequest) {
  const [city, setCity] = useState(initial?.city ?? "");
  const [dayCount, setDayCount] = useState(initial ? String(initial.day_count) : "");

  const trimmedCity = city.trim();
  const parsedDayCount = parseDayCount(dayCount);

  const cityError = city.length > 0 && trimmedCity.length === 0 ? "City is required" : undefined;
  const dayCountError =
    dayCount.length > 0 && parsedDayCount === null
      ? `Enter a whole number from ${MIN_TRIP_DAYS} to ${MAX_TRIP_DAYS}`
      : undefined;

  /** The validated request body, or `null` when the form is not submittable. */
  const request: GenerateTripRequest | null =
    trimmedCity.length > 0 && parsedDayCount !== null ? { city: trimmedCity, day_count: parsedDayCount } : null;
  const canSubmit = request !== null;

  const fill = useCallback((values: GenerateTripRequest) => {
    setCity(values.city);
    setDayCount(String(values.day_count));
  }, []);

  const reset = useCallback(() => {
    setCity("");
    setDayCount("");
  }, []);

  return {
    city,
    setCity,
    dayCount,
    setDayCount,
    cityError,
    dayCountError,
    canSubmit,
    request,
    fill,
    reset,
  };
}
