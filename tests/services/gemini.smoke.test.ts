import { afterEach, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({ GEMINI_API_KEY: "test-key" }));

afterEach(() => {
  vi.unstubAllGlobals();
});

it("generateItinerary returns one day for a minimal valid Gemini response", async () => {
  const plan = {
    city_recognized: true,
    days: [{ day_number: 1, points: [{ name: "Eiffel Tower" }] }],
  };
  const fetchStub = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }] }), {
      status: 200,
    }),
  );
  vi.stubGlobal("fetch", fetchStub);

  const { generateItinerary } = await import("@/lib/services/gemini");
  const result = await generateItinerary("Paris", 1);

  expect(result.days).toHaveLength(1);
  expect(fetchStub).toHaveBeenCalledTimes(1);
});
