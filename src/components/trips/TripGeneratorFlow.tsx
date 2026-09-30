import React, { useEffect, useRef, useState } from "react";
import GeneratorForm from "@/components/trips/GeneratorForm";
import PlanReview from "@/components/trips/PlanReview";
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
  const cityInputRef = useRef<HTMLInputElement>(null);
  // Set by Accept/Discard: the review unmounts, so focus goes back to the form instead of <body>.
  const returnFocusToForm = useRef(false);

  // The form unmounts when the review appears; move focus so keyboard users are not dropped at <body>.
  useEffect(() => {
    if (status === "review") reviewHeadingRef.current?.focus();
    if (status === "idle" && returnFocusToForm.current) {
      returnFocusToForm.current = false;
      // preventScroll: after Accept the list scrolls to the highlighted new trip.
      cityInputRef.current?.focus({ preventScroll: true });
    }
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
      returnFocusToForm.current = true;
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
    returnFocusToForm.current = true;
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
    return (
      <>
        {liveRegion}
        <PlanReview
          plan={plan}
          isSaving={isSaving}
          saveError={saveError}
          headingRef={reviewHeadingRef}
          onAccept={() => void handleAccept()}
          onDiscard={handleDiscard}
        />
      </>
    );
  }

  return (
    <>
      {liveRegion}
      <GeneratorForm
        city={form.city}
        dayCount={form.dayCount}
        cityError={form.cityError}
        dayCountError={form.dayCountError}
        canSubmit={form.canSubmit}
        isLoading={isLoading}
        submitted={submitted}
        error={status === "error" ? error : null}
        successMessage={successMessage}
        onCityChange={form.setCity}
        onDayCountChange={form.setDayCount}
        onSubmit={handleSubmit}
        onTryAgain={handleTryAgain}
        cityInputRef={cityInputRef}
      />
    </>
  );
}
