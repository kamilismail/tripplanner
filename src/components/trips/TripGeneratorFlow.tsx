import React, { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, CircleCheck, RotateCcw, Sparkles, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import DayPointsList from "@/components/trips/DayPointsList";
import { useTripGenerationForm } from "@/components/hooks/useTripGenerationForm";
import { MAX_TRIP_DAYS, MIN_TRIP_DAYS } from "@/lib/services/itinerary-schema";
import type { ApiErrorResponse, GeneratedTripPlan, GenerateTripRequest, TripWithPoints } from "@/types";

type Status = "idle" | "loading" | "review" | "error";

interface Props {
  /** Called after a plan has been accepted and saved, with the persisted trip (`null` if the response was unreadable). */
  onTripSaved?: (trip: TripWithPoints | null) => void;
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as Partial<ApiErrorResponse> | null;
    return body?.error;
  } catch {
    return undefined;
  }
}

/** The 201 body of `POST /api/trips` is the persisted trip with its points; `null` if it can't be read. */
async function readSavedTrip(response: Response): Promise<TripWithPoints | null> {
  try {
    const body = (await response.json()) as Partial<TripWithPoints> | null;
    return body && typeof body.id === "string" && Array.isArray(body.trip_points) ? (body as TripWithPoints) : null;
  } catch {
    return null;
  }
}

function generationErrorMessage(status: number, code: string | undefined): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (code === "invalid_input") return `Enter a city and a day count from ${MIN_TRIP_DAYS} to ${MAX_TRIP_DAYS}.`;
  if (code === "generation_failed") {
    return "We couldn't generate a plan for that city. Check the city name or try again.";
  }
  return "Something went wrong while generating your plan. Please try again.";
}

function saveErrorMessage(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  return "We couldn't save your trip. Please try again.";
}

const NETWORK_ERROR = "Network error. Check your connection and try again.";

export default function TripGeneratorFlow({ onTripSaved }: Props) {
  const form = useTripGenerationForm();
  const [status, setStatus] = useState<Status>("idle");
  const [submitted, setSubmitted] = useState<GenerateTripRequest | null>(null);
  // The generated plan lives only here until accepted — never persisted as a draft.
  const [plan, setPlan] = useState<GeneratedTripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);

  // The form unmounts when the review appears; move focus so keyboard users are not dropped at <body>.
  useEffect(() => {
    if (status === "review") reviewHeadingRef.current?.focus();
  }, [status]);

  async function generate(request: GenerateTripRequest) {
    setSubmitted(request);
    setStatus("loading");
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/trips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      // A redirect means the session expired and we landed on the sign-in page.
      if (response.redirected || !response.ok) {
        const status = response.redirected ? 401 : response.status;
        setError(generationErrorMessage(status, await readErrorCode(response)));
        setStatus("error");
        return;
      }

      const body = (await response.json()) as Partial<GeneratedTripPlan> | null;
      // The server validates with zod; this only keeps a malformed body from crashing the review render.
      if (!body || !Array.isArray(body.days)) {
        setError(generationErrorMessage(response.status, undefined));
        setStatus("error");
        return;
      }

      setPlan(body as GeneratedTripPlan);
      setSaveError(null);
      setStatus("review");
    } catch {
      setError(NETWORK_ERROR);
      setStatus("error");
    }
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.request || status === "loading") return;
    void generate(form.request);
  }

  function handleTryAgain() {
    if (!submitted) return;
    form.fill(submitted);
    void generate(submitted);
  }

  async function handleAccept() {
    if (!plan) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: plan.city, day_count: plan.day_count, days: plan.days }),
      });

      if (response.redirected || !response.ok) {
        setSaveError(saveErrorMessage(response.redirected ? 401 : response.status));
        return;
      }

      const savedTrip = await readSavedTrip(response);

      setPlan(null);
      setSubmitted(null);
      form.reset();
      setSuccessMessage(`Your ${plan.day_count}-day trip to ${plan.city} has been saved.`);
      setStatus("idle");
      onTripSaved?.(savedTrip);
    } catch {
      setSaveError(NETWORK_ERROR);
    } finally {
      setIsSaving(false);
    }
  }

  function handleDiscard() {
    setPlan(null);
    setSaveError(null);
    if (submitted) form.fill(submitted);
    setStatus("idle");
  }

  const isLoading = status === "loading";

  let announcement = "";
  if (isLoading && submitted) announcement = `Generating a ${submitted.day_count}-day plan for ${submitted.city}.`;
  else if (status === "review" && plan)
    announcement = `Your ${plan.day_count}-day plan for ${plan.city} is ready to review.`;
  else if (successMessage) announcement = successMessage;

  // Rendered first by both views so it stays mounted across view switches and announcements are not missed.
  const liveRegion = (
    <p role="status" aria-live="polite" className="sr-only">
      {announcement}
    </p>
  );

  if (status === "review" && plan) {
    const days = [...plan.days].sort((a, b) => a.day_number - b.day_number);

    return (
      <>
        {liveRegion}
        <section className="space-y-6" aria-labelledby="trip-review-heading">
          <div>
            <h2
              id="trip-review-heading"
              ref={reviewHeadingRef}
              tabIndex={-1}
              className="text-foreground text-xl font-semibold outline-none"
            >
              {plan.day_count}-day plan for {plan.city}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">Review the plan, then accept it to save or discard it.</p>
          </div>

          <DayPointsList days={days} headingLevel="h3" dayClassName="border-border bg-card rounded-xl border p-4" />

          {saveError && <ErrorAlert message={saveError} />}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={handleDiscard} disabled={isSaving}>
              <X className="size-4" />
              Discard
            </Button>
            <Button type="button" onClick={() => void handleAccept()} disabled={isSaving}>
              {isSaving ? <Spinner /> : <Check className="size-4" />}
              {isSaving ? "Saving..." : "Accept"}
            </Button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      {liveRegion}
      <div className="space-y-4">
        {successMessage && (
          // No alert role: the live region above already announces the message once.
          <Alert variant="success" role={undefined}>
            <CircleCheck aria-hidden="true" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        <form className="space-y-4" onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
          <fieldset disabled={isLoading} className="space-y-4 disabled:opacity-60">
            <div>
              <label htmlFor="trip-city" className="text-foreground mb-1 block text-sm font-medium">
                City
              </label>
              <Input
                id="trip-city"
                name="city"
                value={form.city}
                onChange={(e) => {
                  form.setCity(e.target.value);
                }}
                placeholder="e.g. Kraków"
                autoComplete="off"
                aria-invalid={form.cityError ? true : undefined}
              />
              {form.cityError && <FieldError message={form.cityError} />}
            </div>

            <div>
              <label htmlFor="trip-day-count" className="text-foreground mb-1 block text-sm font-medium">
                Number of days
              </label>
              <Input
                id="trip-day-count"
                name="day_count"
                type="number"
                inputMode="numeric"
                min={MIN_TRIP_DAYS}
                max={MAX_TRIP_DAYS}
                step={1}
                value={form.dayCount}
                onChange={(e) => {
                  form.setDayCount(e.target.value);
                }}
                placeholder={`${MIN_TRIP_DAYS}–${MAX_TRIP_DAYS}`}
                aria-invalid={form.dayCountError ? true : undefined}
              />
              {form.dayCountError && <FieldError message={form.dayCountError} />}
            </div>

            <Button type="submit" disabled={!form.canSubmit || isLoading} className="w-full">
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

        {status === "error" && error && (
          <div className="space-y-3">
            <ErrorAlert message={error} />
            <Button type="button" variant="outline" onClick={handleTryAgain} disabled={!submitted}>
              <RotateCcw className="size-4" />
              Try again
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
      <CircleAlert aria-hidden="true" className="size-3" />
      {message}
    </p>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
