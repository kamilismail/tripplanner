import React, { useCallback, useState } from "react";
import TripGeneratorFlow from "@/components/trips/TripGeneratorFlow";
import TripList from "@/components/trips/TripList";
import { useTrips } from "@/components/hooks/useTrips";
import type { TripWithPoints } from "@/types";

interface Props {
  /** Server-rendered header for the generator card (passed from Astro as slot content). */
  children?: React.ReactNode;
}

const cardClass = "rounded-2xl border border-white/10 bg-white/10 p-8 text-white backdrop-blur-xl";

/** Lifts the trip list state so an accepted plan shows up in the list without a page reload. */
export default function TripsPanel({ children }: Props) {
  const { trips, isLoading, error, addTrip, refresh } = useTrips();
  const [newTripId, setNewTripId] = useState<string | null>(null);

  const handleTripSaved = useCallback(
    (trip: TripWithPoints | null) => {
      // The save response already holds the persisted trip; only re-fetch if it could not be read.
      if (trip) {
        addTrip(trip);
        setNewTripId(trip.id);
      } else {
        refresh();
      }
    },
    [addTrip, refresh],
  );

  return (
    <div className="space-y-6">
      <div className={cardClass}>
        {children}
        <TripGeneratorFlow onTripSaved={handleTripSaved} />
      </div>

      <section className={cardClass} aria-labelledby="saved-trips-heading">
        <h2 id="saved-trips-heading" className="mb-6 text-2xl font-semibold text-white">
          Your trips
        </h2>
        <TripList trips={trips} isLoading={isLoading} error={error} newTripId={newTripId} />
      </section>
    </div>
  );
}
