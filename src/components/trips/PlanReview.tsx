import React, { useId } from "react";
import { Check, CircleAlert, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import DayPointsList from "@/components/trips/DayPointsList";
import type { GeneratedTripPlan } from "@/types";

interface Props {
  plan: GeneratedTripPlan;
  isSaving: boolean;
  saveError: string | null;
  /** The flow focuses the heading when the review appears, so keyboard users are not dropped at <body>. */
  headingRef?: React.Ref<HTMLHeadingElement>;
  onAccept: () => void;
  onDiscard: () => void;
}

/** A generated plan with Accept/Discard. Stateless: the flow owns saving and focus. */
export default function PlanReview({ plan, isSaving, saveError, headingRef, onAccept, onDiscard }: Props) {
  // Unique per instance, so several reviews can render on one page (the kitchen sink).
  const headingId = useId();
  const days = [...plan.days].sort((a, b) => a.day_number - b.day_number);

  return (
    <section className="space-y-6" aria-labelledby={headingId}>
      <div>
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-foreground text-xl font-semibold outline-none"
        >
          {plan.day_count}-day plan for {plan.city}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">Review the plan, then accept it to save or discard it.</p>
      </div>

      <DayPointsList days={days} headingLevel="h3" dayClassName="border-border bg-card rounded-xl border p-4" />

      {saveError && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDiscard} disabled={isSaving}>
          <X className="size-4" />
          Discard
        </Button>
        <Button type="button" onClick={onAccept} disabled={isSaving}>
          {isSaving ? <Spinner /> : <Check className="size-4" />}
          {isSaving ? "Saving..." : "Accept"}
        </Button>
      </div>
    </section>
  );
}
