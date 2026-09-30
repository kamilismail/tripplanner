import { MapPin } from "lucide-react";

interface DayPoint {
  name: string;
  description?: string | null;
}

interface Day {
  day_number: number;
  points: DayPoint[];
}

interface Props {
  /** Days in display order; points in each day are rendered in the given order. */
  days: Day[];
  /** Heading level for the "Day N" label, so it nests under the surrounding heading. */
  headingLevel: "h3" | "h4";
  /** Extra classes for each day item (the plan review renders each day as a bordered card). */
  dayClassName?: string;
}

/** "Day N" plus its points — shared by the plan review and a saved trip. */
export default function DayPointsList({ days, headingLevel: Heading, dayClassName }: Props) {
  return (
    <ol className="space-y-4">
      {days.map((day) => (
        <li key={day.day_number} className={dayClassName}>
          <Heading className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
            Day {day.day_number}
          </Heading>
          <ul className="space-y-3">
            {day.points.map((point, index) => (
              <li key={`${day.day_number}-${index}`} className="flex gap-3">
                <MapPin aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="text-foreground font-medium">{point.name}</p>
                  {point.description && <p className="text-muted-foreground text-sm">{point.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
