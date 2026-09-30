import React, { useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import GeneratorForm from "@/components/trips/GeneratorForm";
import PlanReview from "@/components/trips/PlanReview";
import TripList from "@/components/trips/TripList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAX_TRIP_DAYS, MIN_TRIP_DAYS } from "@/lib/services/itinerary-schema";
import type { GeneratedTripPlan, GenerateTripRequest, TripPoint, TripWithPoints } from "@/types";

// Fixtures only: nothing on this page calls the network.

const noop = () => undefined;
const noopSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
  e.preventDefault();
};

const REQUEST: GenerateTripRequest = { city: "Kraków", day_count: 2 };

const PLAN: GeneratedTripPlan = {
  city: "Kraków",
  day_count: 2,
  days: [
    {
      day_number: 1,
      points: [
        { name: "Wawel Royal Castle", description: "Castle and cathedral on the hill above the Vistula." },
        { name: "Main Market Square", description: "The medieval square with the Cloth Hall." },
      ],
    },
    {
      day_number: 2,
      points: [
        { name: "Kazimierz", description: "The old Jewish quarter, full of cafés and galleries." },
        { name: "Zakrzówek" },
      ],
    },
  ],
};

const USER_ID = "00000000-0000-4000-8000-000000000000";

function point(tripId: string, day: number, order: number, name: string, description: string | null): TripPoint {
  return {
    id: `${tripId}-p${day}-${order}`,
    trip_id: tripId,
    user_id: USER_ID,
    day_number: day,
    order_index: order,
    name,
    description,
    latitude: null,
    longitude: null,
    created_at: "2026-09-28T10:00:00.000Z",
  };
}

/** Distinct ids per section, so several lists on one page never share element ids. */
function fixtureTrips(section: string): TripWithPoints[] {
  const lisbon = `${section}-lisbon`;
  const rome = `${section}-rome`;
  return [
    {
      id: lisbon,
      user_id: USER_ID,
      city: "Lisbon",
      day_count: 2,
      created_at: "2026-09-29T18:30:00.000Z",
      trip_points: [
        point(lisbon, 2, 0, "LX Factory", "Weekend market in a former industrial complex."),
        point(lisbon, 1, 1, "Alfama", "Walk the steep lanes up to the castle."),
        point(lisbon, 1, 0, "Belém Tower", null),
      ],
    },
    {
      id: rome,
      user_id: USER_ID,
      city: "Rome",
      day_count: 1,
      created_at: "2026-09-20T09:15:00.000Z",
      trip_points: [
        point(rome, 1, 0, "Colosseum", "Book the first entry slot."),
        point(rome, 1, 1, "Trastevere", "Dinner across the river."),
      ],
    },
  ];
}

const LIST_ERROR = "We couldn't load your trips. Please try again.";

function Cell({ label, children, id }: { label: string; children: React.ReactNode; id?: string }) {
  return (
    <Card id={id} className="scroll-mt-20 gap-4">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs tracking-wide uppercase">{label}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-foreground text-xl font-semibold">{title}</h2>
        {note && <p className="text-muted-foreground text-sm">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** Dev-only visual gate: every state of the /trips view, rendered from fixtures. */
export default function KitchenSink() {
  // Re-keying the list remounts the new trip, which replays its (timed) highlight.
  const [highlightRun, setHighlightRun] = useState(0);
  const listTrips = fixtureTrips("list");

  const formBase = {
    cityError: undefined,
    dayCountError: undefined,
    canSubmit: false,
    isLoading: false,
    submitted: null,
    error: null,
    successMessage: null,
    onCityChange: noop,
    onDayCountChange: noop,
    onSubmit: noopSubmit,
    onTryAgain: noop,
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-foreground text-2xl font-semibold">Kitchen sink</h1>
        <p className="text-muted-foreground text-sm">
          Every state of the /trips view from fixtures. Hover and Tab through the controls to check hover and focus.
        </p>
      </div>

      <Section
        title="Buttons"
        note="Hover: each variant. Focus-visible: the same ring on every control. Disabled: one opacity."
      >
        <Cell label="Default">
          <div className="flex flex-wrap gap-3">
            <Button>
              <Plus />
              Default
            </Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
        </Cell>
        <Cell label="Disabled">
          <div className="flex flex-wrap gap-3">
            <Button disabled>
              <Plus />
              Default
            </Button>
            <Button variant="outline" disabled>
              Outline
            </Button>
            <Button variant="secondary" disabled>
              Secondary
            </Button>
            <Button variant="ghost" disabled>
              Ghost
            </Button>
            <Button variant="link" disabled>
              Link
            </Button>
            <Button variant="destructive" disabled>
              Destructive
            </Button>
          </div>
        </Cell>
      </Section>

      <Section title="Generator form" note="Empty: N/A, the form always renders.">
        <Cell label="Default" id="new-trip">
          <GeneratorForm {...formBase} city="" dayCount="" />
        </Cell>
        <Cell label="Field error">
          <GeneratorForm
            {...formBase}
            city=" "
            dayCount="40"
            cityError="City is required"
            dayCountError={`Enter a whole number from ${MIN_TRIP_DAYS} to ${MAX_TRIP_DAYS}`}
          />
        </Cell>
        <Cell label="Disabled / loading">
          <GeneratorForm
            {...formBase}
            city={REQUEST.city}
            dayCount={String(REQUEST.day_count)}
            canSubmit
            isLoading
            submitted={REQUEST}
          />
        </Cell>
        <Cell label="Error">
          <GeneratorForm
            {...formBase}
            city={REQUEST.city}
            dayCount={String(REQUEST.day_count)}
            canSubmit
            submitted={REQUEST}
            error="We couldn't generate a plan for that city. Check the city name or try again."
          />
        </Cell>
        <Cell label="Success">
          <GeneratorForm {...formBase} city="" dayCount="" successMessage="Your 2-day trip to Kraków has been saved." />
        </Cell>
      </Section>

      <Section title="Plan review" note="Empty: N/A, the review renders only with a plan.">
        <Cell label="Default">
          <PlanReview plan={PLAN} isSaving={false} saveError={null} onAccept={noop} onDiscard={noop} />
        </Cell>
        <Cell label="Saving (disabled / loading)">
          <PlanReview plan={PLAN} isSaving saveError={null} onAccept={noop} onDiscard={noop} />
        </Cell>
        <Cell label="Save error">
          <PlanReview
            plan={PLAN}
            isSaving={false}
            saveError="We couldn't save your trip. Please try again."
            onAccept={noop}
            onDiscard={noop}
          />
        </Cell>
      </Section>

      <Section title="Trip list">
        <Cell label="Loading (first load)">
          <TripList trips={null} isLoading error={null} onRetry={noop} />
        </Cell>
        <Cell label="Error (first load)">
          <TripList trips={null} isLoading={false} error={LIST_ERROR} onRetry={noop} />
        </Cell>
        <Cell label="Empty">
          <TripList trips={[]} isLoading={false} error={null} onRetry={noop} />
        </Cell>
        <Cell label="Error with list (failed refresh)">
          <TripList trips={fixtureTrips("error")} isLoading={false} error={LIST_ERROR} onRetry={noop} />
        </Cell>
        <Cell label="List (new trip expanded and highlighted)">
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setHighlightRun((run) => run + 1);
              }}
            >
              <RotateCcw />
              Replay highlight
            </Button>
            <TripList
              key={highlightRun}
              trips={listTrips}
              isLoading={false}
              error={null}
              newTripId={listTrips[0].id}
              onRetry={noop}
            />
          </div>
        </Cell>
      </Section>
    </div>
  );
}
