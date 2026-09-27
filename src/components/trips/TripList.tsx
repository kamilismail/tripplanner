import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, MapPin } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { ServerError } from "@/components/auth/ServerError";
import type { UseTripsResult } from "@/components/hooks/useTrips";
import { cn } from "@/lib/utils";
import type { TripPoint, TripWithPoints } from "@/types";

type Props = Pick<UseTripsResult, "trips" | "isLoading" | "error"> & {
  /** Id of the trip saved in this visit; it starts expanded, is scrolled into view and briefly highlighted. */
  newTripId?: string | null;
};

interface TripDay {
  day_number: number;
  points: TripPoint[];
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const HIGHLIGHT_MS = 2500;

/** The API returns points unordered; group them by day and order within each day. */
function groupPointsByDay(points: TripPoint[]): TripDay[] {
  const sorted = [...points].sort((a, b) => a.day_number - b.day_number || a.order_index - b.order_index);
  const days: TripDay[] = [];
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

export default function TripList({ trips, isLoading, error, newTripId = null }: Props) {
  // First load: nothing to show yet.
  if (trips === null) {
    if (error) return <ServerError message={error} />;
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-blue-100/70">
        <Spinner className="text-purple-300" />
        Loading your trips...
      </p>
    );
  }

  return (
    <div className="space-y-4" aria-busy={isLoading}>
      {/* A failed refresh keeps the last list visible and reports the error above it. */}
      <ServerError message={error} />

      {trips.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-blue-100/70">
          No trips yet. Generate a plan above and accept it to save your first trip.
        </p>
      ) : (
        <ul className={cn("space-y-4", isLoading && "opacity-60")}>
          {trips.map((trip) => (
            <TripItem key={trip.id} trip={trip} isNew={trip.id === newTripId} />
          ))}
        </ul>
      )}
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
          "rounded-xl border border-white/10 bg-white/5 motion-safe:transition-[border-color,box-shadow] motion-safe:duration-700",
          highlighted && "border-purple-400/70 shadow-[0_0_0_3px_rgb(192_132_252/0.35)]",
        )}
      >
        <h3>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => {
              setExpanded((value) => !value);
            }}
            className="flex w-full items-start justify-between gap-4 rounded-xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <span>
              <span className="block text-lg font-semibold text-white">{trip.city}</span>
              <span className="mt-1 flex items-center gap-2 text-sm font-normal text-blue-100/60">
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
                "mt-1 size-5 shrink-0 text-blue-100/60 motion-safe:transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
        </h3>

        <ol id={panelId} hidden={!expanded} className="space-y-4 px-4 pb-4">
          {days.map((day) => (
            <li key={day.day_number}>
              <h4 className="mb-2 text-sm font-semibold tracking-wide text-purple-200 uppercase">
                Day {day.day_number}
              </h4>
              <ul className="space-y-3">
                {day.points.map((point) => (
                  <li key={point.id} className="flex gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-purple-300" />
                    <div>
                      <p className="font-medium text-white">{point.name}</p>
                      {point.description && <p className="text-sm text-blue-100/70">{point.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </article>
    </li>
  );
}
