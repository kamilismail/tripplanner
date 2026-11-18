import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIRoute } from "astro";
import { geminiEnvelope, scriptFetch, validGeminiBody, type FetchStep } from "../helpers/gemini-stub";
import { settle } from "../helpers/timers";

type RouteContext = Parameters<APIRoute>[0];

interface LoadedRoute {
  POST: APIRoute;
  createClient: ReturnType<typeof vi.fn>;
}

/** Fresh import of the route with the key and Supabase mocked. */
async function loadRoute(options: { failServiceWith?: Error } = {}): Promise<LoadedRoute> {
  vi.resetModules();
  vi.doMock("astro:env/server", () => ({ GEMINI_API_KEY: "test-key" }));
  const createClient = vi.fn();
  vi.doMock("@/lib/supabase", () => ({ createClient }));
  if (options.failServiceWith) {
    const failure = options.failServiceWith;
    vi.doMock("@/lib/services/gemini", async () => ({
      ...(await vi.importActual<object>("@/lib/services/gemini")),
      generateItinerary: () => Promise.reject(failure),
    }));
  }
  const { POST } = await import("@/pages/api/trips/generate");
  return { POST, createClient };
}

function makeContext(options: { user?: boolean; body?: unknown; rawBody?: string }): RouteContext {
  const raw = options.rawBody ?? JSON.stringify(options.body);
  return {
    locals: { user: options.user === false ? null : { id: "user-1" } },
    request: new Request("http://localhost/api/trips/generate", { method: "POST", body: raw }),
  } as unknown as RouteContext;
}

const busy: FetchStep = { status: 503, body: { error: { message: "The model is overloaded." } } };
const validRequest = { city: "Paris", day_count: 2 };

describe("POST /api/trips/generate", () => {
  let route: LoadedRoute;

  beforeEach(async () => {
    vi.useFakeTimers();
    route = await loadRoute();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.doUnmock("astro:env/server");
    vi.doUnmock("@/lib/supabase");
    vi.doUnmock("@/lib/services/gemini");
  });

  /** Nothing is persisted: no Supabase client, and fetch only ever hit Gemini. */
  function expectNothingPersisted(fetchStub: { urls: string[] }) {
    expect(route.createClient).not.toHaveBeenCalled();
    for (const url of fetchStub.urls) {
      expect(url).toContain("generativelanguage.googleapis.com");
    }
  }

  describe("rejected before reaching Gemini", () => {
    it("returns 401 without a signed-in user", async () => {
      const fetchStub = scriptFetch([{ status: 200, body: validGeminiBody(2) }]);

      const response = await route.POST(makeContext({ user: false, body: validRequest }));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
      expect(fetchStub.calls).toBe(0);
      expectNothingPersisted(fetchStub);
    });

    it("returns 400 invalid_json for a body that is not JSON", async () => {
      const fetchStub = scriptFetch([{ status: 200, body: validGeminiBody(2) }]);

      const response = await route.POST(makeContext({ rawBody: "{not json" }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_json" });
      expect(fetchStub.calls).toBe(0);
      expectNothingPersisted(fetchStub);
    });

    it.each([
      { name: "an empty city", body: { city: "", day_count: 2 } },
      { name: "a whitespace-only city", body: { city: "   ", day_count: 2 } },
      { name: "day_count 0", body: { city: "Paris", day_count: 0 } },
    ])("returns 400 invalid_input for $name", async ({ body }) => {
      const fetchStub = scriptFetch([{ status: 200, body: validGeminiBody(2) }]);

      const response = await route.POST(makeContext({ body }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_input" });
      expect(fetchStub.calls).toBe(0);
      expectNothingPersisted(fetchStub);
    });
  });

  describe("success", () => {
    it("returns 200 with city, day_count and days", async () => {
      const fetchStub = scriptFetch([{ status: 200, body: validGeminiBody(2) }]);

      const response = await settle(route.POST(makeContext({ body: validRequest })));

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      expect(response.value.status).toBe(200);
      expect(await response.value.json()).toEqual({
        city: "Paris",
        day_count: 2,
        days: [
          { day_number: 1, points: [{ name: "Point 1", description: "A place worth seeing." }] },
          { day_number: 2, points: [{ name: "Point 2", description: "A place worth seeing." }] },
        ],
      });
      expect(fetchStub.calls).toBe(1);
      expectNothingPersisted(fetchStub);
    });

    it("returns 200 when Gemini is busy twice and then answers", async () => {
      const fetchStub = scriptFetch([busy, busy, { status: 200, body: validGeminiBody(2) }]);

      const response = await settle(route.POST(makeContext({ body: validRequest })));

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      expect(response.value.status).toBe(200);
      expect(fetchStub.calls).toBe(3);
      expectNothingPersisted(fetchStub);
    });
  });

  describe("Gemini failures", () => {
    const failureCases: { name: string; steps: FetchStep[]; calls: number }[] = [
      { name: "six consecutive 503", steps: [busy, busy, busy, busy, busy, busy], calls: 6 },
      { name: "an empty candidate text", steps: [{ status: 200, body: geminiEnvelope("") }], calls: 1 },
      {
        name: "malformed JSON text",
        steps: [{ status: 200, body: geminiEnvelope('{"city_recognized": true, "da') }],
        calls: 1,
      },
      {
        name: "a schema mismatch",
        steps: [{ status: 200, body: geminiEnvelope(JSON.stringify({ city_recognized: true })) }],
        calls: 1,
      },
      {
        name: "city_recognized false",
        steps: [
          {
            status: 200,
            body: geminiEnvelope(
              JSON.stringify({ city_recognized: false, days: [{ day_number: 1, points: [{ name: "X" }] }] }),
            ),
          },
        ],
        calls: 1,
      },
      {
        name: "the wrong day count",
        steps: [{ status: 200, body: validGeminiBody(1) }],
        calls: 1,
      },
    ];

    it.each(failureCases)("returns 502 generation_failed for $name and persists nothing", async ({ steps, calls }) => {
      const fetchStub = scriptFetch(steps);

      const response = await settle(route.POST(makeContext({ body: validRequest })));

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      expect(response.value.status).toBe(502);
      const body: unknown = await response.value.json();
      expect(body).toEqual({ error: "generation_failed" });
      expect(body).not.toHaveProperty("days");
      expect(fetchStub.calls).toBe(calls);
      expectNothingPersisted(fetchStub);
    });
  });

  describe("unexpected errors", () => {
    it("returns 500 unexpected_error when the service throws a non-generation error", async () => {
      route = await loadRoute({ failServiceWith: new TypeError("boom") });
      const fetchStub = scriptFetch([{ status: 200, body: validGeminiBody(2) }]);

      const response = await settle(route.POST(makeContext({ body: validRequest })));

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      expect(response.value.status).toBe(500);
      expect(await response.value.json()).toEqual({ error: "unexpected_error" });
      expectNothingPersisted(fetchStub);
    });
  });
});
