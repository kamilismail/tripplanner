import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, CircleAlert, RotateCcw, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import DayPointsList from "@/components/trips/DayPointsList";
import type { UseTripsResult } from "@/components/hooks/useTrips";
import { cn } from "@/lib/utils";
import type { DayWithPoints, TripPoint, TripWithPoints } from "@/types";

type Props = Pick<UseTripsResult, "trips" | "isLoading" | "error"> & {
  /** Id of the trip saved in this visit; it starts expanded, is scrolled into view and briefly highlighted. */
  newTripId?: string | null;
  /** Re-fetches the list after a failed load. */
  onRetry: () => void;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const HIGHLIGHT_MS = 2500;

/** The API returns points unordered; group them by day and order within each day. */
function groupPointsByDay(points: TripPoint[]): DayWithPoints<TripPoint>[] {
  const sorted = [...points].sort((a, b) => a.day_number - b.day_number || a.order_index - b.order_index);
  const days: DayWithPoints<TripPoint>[] = [];
  for (const point of sorted) {
    const last = days.at(-1);
    if (last?.day_number === point.day_number) last.points.push(point);
    else days.push({ day_number: point.day_number, points: [point] });
  }
  return days;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export default function TripList({ trips, isLoading, error, newTripId = null, onRetry }: Props) {
  // First load: nothing to show yet.
  if (trips === null) {
    if (error && !isLoading) return <ListError message={error} isLoading={isLoading} onRetry={onRetry} />;
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">Loading your trips...</span>
        {/* Same box as a collapsed trip item, so the list does not jump when it arrives. */}
        {[0, 1, 2].map((row) => (
          <div key={row} aria-hidden="true" className="border-border bg-card rounded-xl border p-4">
            <Skeleton className="h-7 w-1/3" />
            <Skeleton className="mt-1 h-5 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-busy={isLoading}>
      {/* A failed refresh keeps the last list visible and reports the error above it. */}
      {error && <ListError message={error} isLoading={isLoading} onRetry={onRetry} />}

      {trips.length === 0 ? (
        <Card className="items-center gap-4 px-6 text-center shadow-none">
          <div className="space-y-1">
            <p className="text-foreground font-medium">No trips yet</p>
            <p className="text-muted-foreground text-sm">
              Generate a plan and accept it — your saved trips will show up here.
            </p>
          </div>
          <Button asChild>
            <a href="#new-trip">
              <Sparkles className="size-4" />
              Plan your first trip
            </a>
          </Button>
        </Card>
      ) : (
        <ul className={cn("space-y-4", isLoading && "opacity-50")}>
          {trips.map((trip) => (
            <TripItem key={trip.id} trip={trip} isNew={trip.id === newTripId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ListError({ message, isLoading, onRetry }: { message: string; isLoading: boolean; onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <CircleAlert aria-hidden="true" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button type="button" variant="outline" onClick={onRetry} disabled={isLoading}>
        {isLoading ? <Spinner /> : <RotateCcw className="size-4" />}
        {isLoading ? "Retrying..." : "Try again"}
      </Button>
    </div>
  );
}

function TripItem({ trip, isNew }: { trip: TripWithPoints; isNew: boolean }) {
  // A just-saved trip mounts fresh (new key), so these initial values only apply to it.
  const [expanded, setExpanded] = useState(isNew);
  const [highlighted, setHighlighted] = useState(isNew);
  const articleRef = useRef<HTMLElement>(null);
  const days = groupPointsByDay(trip.trip_points);
  const panelId = `trip-${trip.id}-points`;

  useEffect(() => {
    if (!isNew) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    articleRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    const timer = window.setTimeout(() => {
      setHighlighted(false);
    }, HIGHLIGHT_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isNew]);

  return (
    <li>
      <article
        ref={articleRef}
        aria-label={trip.city}
        className={cn(
          "border-border bg-card scroll-mt-20 rounded-xl border motion-safe:transition-[border-color,box-shadow] motion-safe:duration-700",
          // `isNew` too: if another trip becomes new, this one's timer is cleared before it ends.
          highlighted && isNew && "ring-primary ring-2",
        )}
      >
        <h3>
          <Button
            type="button"
            variant="ghost"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => {
              setExpanded((value) => !value);
            }}
            className="h-auto w-full items-start justify-between gap-4 rounded-xl p-4 text-left whitespace-normal has-[>svg]:px-4"
          >
            <span>
              <span className="text-foreground block text-lg font-semibold">{trip.city}</span>
              <span className="text-muted-foreground mt-1 flex items-center gap-2 text-sm font-normal">
                <CalendarDays className="size-4 shrink-0" />
                <span>
                  {plural(trip.day_count, "day", "days")} · {plural(trip.trip_points.length, "place", "places")} · saved{" "}
                  <time dateTime={trip.created_at}>{dateFormatter.format(new Date(trip.created_at))}</time>
                </span>
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "text-muted-foreground mt-1 size-5 shrink-0 motion-safe:transition-transform",
                expanded && "rotate-180",
              )}
            />
          </Button>
        </h3>

        <div id={panelId} hidden={!expanded} className="px-4 pb-4">
          <DayPointsList days={days} headingLevel="h4" />
        </div>
      </article>
    </li>
  );
}
