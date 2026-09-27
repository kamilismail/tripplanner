import { useCallback, useEffect, useState } from "react";
import type { TripWithPoints } from "@/types";

export interface UseTripsResult {
  /** `null` until the first successful load. */
  trips: TripWithPoints[] | null;
  isLoading: boolean;
  error: string | null;
  /** Shows a just-saved trip at the top immediately, without waiting for a re-fetch. */
  addTrip: (trip: TripWithPoints) => void;
  /** Re-fetches the list; the previous list stays visible while the refresh is in flight. */
  refresh: () => void;
}

function fetchErrorMessage(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  return "We couldn't load your trips. Please try again.";
}

/** Loads the current user's saved trips from `GET /api/trips`. */
export function useTrips(): UseTripsResult {
  const [trips, setTrips] = useState<TripWithPoints[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // The refreshKey whose fetch last settled; loading is derived rather than set inside the effect.
  const [settledKey, setSettledKey] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Aborting on re-run/unmount keeps a slower, older response from overwriting a newer one.
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/trips", { signal: controller.signal });
        if (controller.signal.aborted) return;

        // A redirect means the session expired and we landed on the sign-in page.
        if (response.redirected || !response.ok) {
          setError(fetchErrorMessage(response.redirected ? 401 : response.status));
          return;
        }

        // An abort during the body read rejects json() with an AbortError, handled in catch.
        const body = (await response.json()) as unknown;
        if (!Array.isArray(body)) {
          setError(fetchErrorMessage(response.status));
          return;
        }

        setTrips(body as TripWithPoints[]);
        setError(null);
      } catch {
        if (controller.signal.aborted) return;
        setError("Network error. Check your connection and try again.");
      } finally {
        if (!controller.signal.aborted) setSettledKey(refreshKey);
      }
    }

    void load();
    return () => {
      controller.abort();
    };
  }, [refreshKey]);

  const addTrip = useCallback((trip: TripWithPoints) => {
    setTrips((current) => [trip, ...(current ?? []).filter((t) => t.id !== trip.id)]);
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  return { trips, isLoading: settledKey !== refreshKey, error, addTrip, refresh };
}
