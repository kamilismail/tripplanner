import React, { useState } from "react";
import { Check, CircleAlert, CircleCheck, MapPin, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ServerError } from "@/components/auth/ServerError";
import { MAX_TRIP_DAYS, MIN_TRIP_DAYS, useTripGenerationForm } from "@/components/hooks/useTripGenerationForm";
import { cn } from "@/lib/utils";
import type { ApiErrorResponse, GeneratedTripPlan, GenerateTripRequest } from "@/types";

type Status = "idle" | "loading" | "review" | "error";

interface Props {
  /** Called after a plan has been accepted and saved (Phase 4 hooks the trip-list refresh here). */
  onTripSaved?: () => void;
}

const inputClass =
  "h-10 rounded-lg border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-white/20 focus-visible:ring-2 focus-visible:ring-purple-400";
const primaryButtonClass = "rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-500";
const secondaryButtonClass = "rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white hover:bg-white/20";

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as Partial<ApiErrorResponse> | null;
    return body?.error;
  } catch {
    return undefined;
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

      if (!response.ok) {
        setError(generationErrorMessage(response.status, await readErrorCode(response)));
        setStatus("error");
        return;
      }

      setPlan((await response.json()) as GeneratedTripPlan);
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

      if (!response.ok) {
        setSaveError(saveErrorMessage(response.status));
        return;
      }

      setPlan(null);
      setSubmitted(null);
      form.reset();
      setSuccessMessage(`Your ${plan.day_count}-day trip to ${plan.city} has been saved.`);
      setStatus("idle");
      onTripSaved?.();
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

  if (status === "review" && plan) {
    const days = [...plan.days].sort((a, b) => a.day_number - b.day_number);

    return (
      <section className="space-y-6" aria-labelledby="trip-review-heading">
        <div>
          <h2 id="trip-review-heading" className="text-xl font-semibold text-white">
            {plan.day_count}-day plan for {plan.city}
          </h2>
          <p className="mt-1 text-sm text-blue-100/60">Review the plan, then accept it to save or discard it.</p>
        </div>

        <ol className="space-y-4">
          {days.map((day) => (
            <li key={day.day_number} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="mb-3 text-sm font-semibold tracking-wide text-purple-200 uppercase">
                Day {day.day_number}
              </h3>
              <ul className="space-y-3">
                {day.points.map((point, index) => (
                  <li key={`${day.day_number}-${index}`} className="flex gap-3">
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

        <ServerError message={saveError} />

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" onClick={handleDiscard} disabled={isSaving} className={secondaryButtonClass}>
            <X className="size-4" />
            Discard
          </Button>
          <Button type="button" onClick={() => void handleAccept()} disabled={isSaving} className={primaryButtonClass}>
            {isSaving ? <Spinner /> : <Check className="size-4" />}
            {isSaving ? "Saving..." : "Accept"}
          </Button>
        </div>
      </section>
    );
  }

  const isLoading = status === "loading";

  return (
    <div className="space-y-4">
      {successMessage && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-900/30 px-3 py-2 text-sm text-green-200"
        >
          <CircleCheck className="size-4 shrink-0" />
          {successMessage}
        </p>
      )}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
        <fieldset disabled={isLoading} className="space-y-4 disabled:opacity-60">
          <div>
            <label htmlFor="trip-city" className="mb-1 block text-sm text-blue-100/80">
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
              className={cn(inputClass, form.cityError && "border-red-400/60 focus-visible:ring-red-400")}
            />
            {form.cityError && <FieldError message={form.cityError} />}
          </div>

          <div>
            <label htmlFor="trip-day-count" className="mb-1 block text-sm text-blue-100/80">
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
              className={cn(inputClass, form.dayCountError && "border-red-400/60 focus-visible:ring-red-400")}
            />
            {form.dayCountError && <FieldError message={form.dayCountError} />}
          </div>

          <Button type="submit" disabled={!form.canSubmit || isLoading} className={cn("w-full", primaryButtonClass)}>
            {isLoading ? <Spinner /> : <Sparkles className="size-4" />}
            {isLoading ? "Generating..." : "Generate plan"}
          </Button>
        </fieldset>
      </form>

      {isLoading && submitted && (
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-blue-100/70">
          <Spinner className="text-purple-300" />
          Generating a {submitted.day_count}-day plan for {submitted.city}. This can take a little while...
        </p>
      )}

      {status === "error" && error && (
        <div className="space-y-3">
          <ServerError message={error} />
          <Button type="button" onClick={handleTryAgain} disabled={!submitted} className={secondaryButtonClass}>
            <RotateCcw className="size-4" />
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-300">
      <CircleAlert className="size-3" />
      {message}
    </p>
  );
}
