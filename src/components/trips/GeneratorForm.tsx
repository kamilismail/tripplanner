import React, { useId } from "react";
import { CircleAlert, CircleCheck, RotateCcw, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { MAX_TRIP_DAYS, MIN_TRIP_DAYS } from "@/lib/services/itinerary-schema";
import type { GenerateTripRequest } from "@/types";

interface Props {
  city: string;
  dayCount: string;
  cityError?: string;
  dayCountError?: string;
  canSubmit: boolean;
  isLoading: boolean;
  /** The request being generated (or last generated); drives the loading hint and "Try again". */
  submitted: GenerateTripRequest | null;
  /** Generation error; shown with a "Try again" button. */
  error: string | null;
  successMessage: string | null;
  onCityChange: (value: string) => void;
  onDayCountChange: (value: string) => void;
  onSubmit: (e: React.SubmitEvent<HTMLFormElement>) => void;
  onTryAgain: () => void;
  /** Lets the flow return focus to the city field after Accept/Discard. */
  cityInputRef?: React.Ref<HTMLInputElement>;
}

/** The city/day-count form with its success, loading and error states. Stateless: the flow owns state and fetching. */
export default function GeneratorForm({
  city,
  dayCount,
  cityError,
  dayCountError,
  canSubmit,
  isLoading,
  submitted,
  error,
  successMessage,
  onCityChange,
  onDayCountChange,
  onSubmit,
  onTryAgain,
  cityInputRef,
}: Props) {
  // Unique per instance, so several forms can render on one page (the kitchen sink).
  const id = useId();
  const cityId = `${id}-city`;
  const dayCountId = `${id}-day-count`;
  const cityErrorId = `${cityId}-error`;
  const dayCountErrorId = `${dayCountId}-error`;

  return (
    <div className="space-y-4">
      {successMessage && (
        // No alert role: the flow's live region already announces the message once.
        <Alert variant="success" role={undefined}>
          <CircleCheck aria-hidden="true" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <form className="space-y-4" onSubmit={onSubmit} noValidate aria-busy={isLoading}>
        {/* Controls apply their own disabled:opacity-50; the fieldset adds none, so it is not stacked. */}
        <fieldset disabled={isLoading} className="space-y-4">
          <div>
            <label htmlFor={cityId} className="text-foreground mb-1 block text-sm font-medium">
              City
            </label>
            <Input
              ref={cityInputRef}
              id={cityId}
              name="city"
              value={city}
              onChange={(e) => {
                onCityChange(e.target.value);
              }}
              placeholder="e.g. Kraków"
              autoComplete="off"
              aria-invalid={cityError ? true : undefined}
              aria-describedby={cityError ? cityErrorId : undefined}
            />
            {cityError && <FieldError id={cityErrorId} message={cityError} />}
          </div>

          <div>
            <label htmlFor={dayCountId} className="text-foreground mb-1 block text-sm font-medium">
              Number of days
            </label>
            <Input
              id={dayCountId}
              name="day_count"
              type="number"
              inputMode="numeric"
              min={MIN_TRIP_DAYS}
              max={MAX_TRIP_DAYS}
              step={1}
              value={dayCount}
              onChange={(e) => {
                onDayCountChange(e.target.value);
              }}
              placeholder={`${MIN_TRIP_DAYS}–${MAX_TRIP_DAYS}`}
              aria-invalid={dayCountError ? true : undefined}
              aria-describedby={dayCountError ? dayCountErrorId : undefined}
            />
            {dayCountError && <FieldError id={dayCountErrorId} message={dayCountError} />}
          </div>

          <Button type="submit" disabled={!canSubmit || isLoading} className="w-full">
            {isLoading ? <Spinner /> : <Sparkles className="size-4" />}
            {isLoading ? "Generating..." : "Generate plan"}
          </Button>
        </fieldset>
      </form>

      {isLoading && submitted && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner className="text-primary" />
          Generating a {submitted.day_count}-day plan for {submitted.city}. This can take a little while...
        </p>
      )}

      {error && (
        <div className="space-y-3">
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button type="button" variant="outline" onClick={onTryAgain} disabled={!submitted}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="text-destructive mt-1 flex items-center gap-1 text-xs">
      <CircleAlert aria-hidden="true" className="size-3" />
      {message}
    </p>
  );
}
