import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settle } from "../helpers/timers";
import { geminiEnvelope, scriptFetch, validGeminiBody, type FetchStep } from "../helpers/gemini-stub";

type GeminiModule = typeof import("@/lib/services/gemini");

/** Fresh import of the service with `astro:env/server` mocked to the given key. */
async function loadService(apiKey: string | undefined): Promise<GeminiModule> {
  vi.resetModules();
  vi.doMock("astro:env/server", () => ({ GEMINI_API_KEY: apiKey }));
  return import("@/lib/services/gemini");
}

const busy: FetchStep = { status: 503, body: { error: { message: "The model is overloaded." } } };

function expectFailure(outcome: Awaited<ReturnType<typeof settle>>, cause: "upstream" | "invalid_response") {
  expect(outcome.ok).toBe(false);
  if (outcome.ok) return;
  expect(outcome.error).toMatchObject({ name: "ItineraryGenerationError", cause });
}

describe("generateItinerary", () => {
  let service: GeminiModule;

  beforeEach(async () => {
    vi.useFakeTimers();
    service = await loadService("test-key");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.doUnmock("astro:env/server");
  });

  describe("success and retry", () => {
    it("returns the plan from a single valid response (control)", async () => {
      const fetchStub = scriptFetch([{ status: 200, body: validGeminiBody(1) }]);

      const outcome = await settle(service.generateItinerary("Paris", 1));

      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.value.days).toHaveLength(1);
        expect(outcome.value.days[0].points[0].name).toBe("Point 1");
      }
      expect(fetchStub.calls).toBe(1);
      expect(fetchStub.urls[0]).toContain("generativelanguage.googleapis.com");
    });

    it("retries 503 twice and returns the plan on the third response", async () => {
      const fetchStub = scriptFetch([busy, busy, { status: 200, body: validGeminiBody(2) }]);

      const outcome = await settle(service.generateItinerary("Paris", 2));

      expect(outcome.ok).toBe(true);
      if (outcome.ok) expect(outcome.value.days).toHaveLength(2);
      expect(fetchStub.calls).toBe(3);
    });

    it("does not retry again when a retried request returns invalid content", async () => {
      const fetchStub = scriptFetch([busy, { status: 200, body: geminiEnvelope("") }]);

      const outcome = await settle(service.generateItinerary("Paris", 1));

      expectFailure(outcome, "invalid_response");
      expect(fetchStub.calls).toBe(2);
    });

    it("gives up as upstream after exactly 6 consecutive 503 responses", async () => {
      const fetchStub = scriptFetch([busy, busy, busy, busy, busy, busy, { status: 200, body: validGeminiBody(1) }]);

      const outcome = await settle(service.generateItinerary("Paris", 1));

      expectFailure(outcome, "upstream");
      expect(fetchStub.calls).toBe(6);
    });

    it("stops retrying when the shared 60 s deadline would be exceeded", async () => {
      const slowBusy: FetchStep = { ...busy, onCall: () => vi.setSystemTime(Date.now() + 25_000) };
      const fetchStub = scriptFetch([slowBusy, slowBusy, slowBusy, slowBusy, slowBusy, slowBusy]);

      const outcome = await settle(service.generateItinerary("Paris", 1));

      expectFailure(outcome, "upstream");
      expect(fetchStub.calls).toBe(3);
    });
  });

  describe("upstream failures that are not retried", () => {
    it("treats a network error as upstream after a single call", async () => {
      const fetchStub = scriptFetch([{ throws: new TypeError("fetch failed") }]);

      const outcome = await settle(service.generateItinerary("Paris", 1));

      expectFailure(outcome, "upstream");
      expect(fetchStub.calls).toBe(1);
    });

    it("does not retry HTTP 429", async () => {
      const fetchStub = scriptFetch([
        { status: 429, body: {} },
        { status: 200, body: validGeminiBody(1) },
      ]);

      const outcome = await settle(service.generateItinerary("Paris", 1));

      expectFailure(outcome, "upstream");
      expect(fetchStub.calls).toBe(1);
    });

    it("does not retry HTTP 500", async () => {
      const fetchStub = scriptFetch([
        { status: 500, body: {} },
        { status: 200, body: validGeminiBody(1) },
      ]);

      const outcome = await settle(service.generateItinerary("Paris", 1));

      expectFailure(outcome, "upstream");
      expect(fetchStub.calls).toBe(1);
    });

    it("fails as upstream without calling Gemini when GEMINI_API_KEY is missing", async () => {
      const keyless = await loadService(undefined);
      const fetchStub = scriptFetch([{ status: 200, body: validGeminiBody(1) }]);

      const outcome = await settle(keyless.generateItinerary("Paris", 1));

      expectFailure(outcome, "upstream");
      expect(fetchStub.calls).toBe(0);
    });
  });

  describe("invalid 200 responses", () => {
    const invalidCases: { name: string; step: FetchStep; days: number }[] = [
      { name: "a non-JSON body", step: { status: 200, body: "<html>Bad gateway</html>" }, days: 1 },
      { name: "no candidates", step: { status: 200, body: {} }, days: 1 },
      {
        name: "a safety block (promptFeedback.blockReason, no candidates)",
        step: { status: 200, body: { promptFeedback: { blockReason: "SAFETY" } } },
        days: 1,
      },
      { name: "an empty-string candidate text", step: { status: 200, body: geminiEnvelope("") }, days: 1 },
      {
        name: "truncated JSON in the candidate text",
        step: { status: 200, body: geminiEnvelope('{"city_recognized": true, "days": [{"day_number": 1, "po') },
        days: 1,
      },
      {
        name: "valid JSON without a days field",
        step: { status: 200, body: geminiEnvelope(JSON.stringify({ city_recognized: true })) },
        days: 1,
      },
      {
        name: "a point with an empty name",
        step: {
          status: 200,
          body: geminiEnvelope(
            JSON.stringify({ city_recognized: true, days: [{ day_number: 1, points: [{ name: "" }] }] }),
          ),
        },
        days: 1,
      },
      {
        name: "city_recognized false",
        step: {
          status: 200,
          body: geminiEnvelope(
            JSON.stringify({ city_recognized: false, days: [{ day_number: 1, points: [{ name: "Placeholder" }] }] }),
          ),
        },
        days: 1,
      },
      {
        name: "fewer days than requested",
        step: {
          status: 200,
          body: geminiEnvelope(
            JSON.stringify({ city_recognized: true, days: [{ day_number: 1, points: [{ name: "A" }] }] }),
          ),
        },
        days: 3,
      },
      {
        name: "a duplicate day number",
        step: {
          status: 200,
          body: geminiEnvelope(
            JSON.stringify({
              city_recognized: true,
              days: [
                { day_number: 1, points: [{ name: "A" }] },
                { day_number: 1, points: [{ name: "B" }] },
              ],
            }),
          ),
        },
        days: 2,
      },
    ];

    it.each(invalidCases)("rejects $name as invalid_response without retrying", async ({ step, days }) => {
      const fetchStub = scriptFetch([step, { status: 200, body: validGeminiBody(days) }]);

      const outcome = await settle(service.generateItinerary("Paris", days));

      expectFailure(outcome, "invalid_response");
      expect(fetchStub.calls).toBe(1);
    });
  });
});
