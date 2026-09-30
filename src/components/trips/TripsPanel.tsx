import React, { useCallback, useState } from "react";
import TripGeneratorFlow from "@/components/trips/TripGeneratorFlow";
import TripList from "@/components/trips/TripList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTrips } from "@/components/hooks/useTrips";
import type { TripWithPoints } from "@/types";

interface Props {
  /** Server-rendered header for the generator card (passed from Astro as slot content). */
  children?: React.ReactNode;
}

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
      {/* "New trip" in the header jumps here; the scroll margin clears the sticky header (h-14). */}
      <Card id="new-trip" className="scroll-mt-20">
        <CardHeader>{children}</CardHeader>
        <CardContent>
          <TripGeneratorFlow onTripSaved={handleTripSaved} />
        </CardContent>
      </Card>

      <section aria-labelledby="saved-trips-heading">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="saved-trips-heading" className="text-foreground text-xl font-semibold">
                Your trips
              </h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TripList trips={trips} isLoading={isLoading} error={error} newTripId={newTripId} onRetry={refresh} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
