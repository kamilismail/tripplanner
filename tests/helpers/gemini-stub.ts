import { vi } from "vitest";

/** One scripted answer of the fake Gemini endpoint. */
export type FetchStep =
  | {
      status: number;
      /** Object → JSON.stringify'd; string → sent verbatim (use for non-JSON bodies). */
      body?: unknown;
      /** Runs when this step is consumed, e.g. to advance the fake clock. */
      onCall?: () => void;
    }
  | { throws: Error; onCall?: () => void };

export interface ScriptedFetch {
  /** Number of fetch calls made, including calls beyond the script. */
  readonly calls: number;
  readonly urls: string[];
}

/**
 * Installs a global `fetch` stub that answers with `steps` in order. A call
 * beyond the script rejects, and still counts in `calls`, so a test that asserts
 * the exact call count fails with a clear signal instead of hanging.
 */
export function scriptFetch(steps: FetchStep[]): ScriptedFetch {
  const urls: string[] = [];
  const state: ScriptedFetch = {
    get calls() {
      return urls.length;
    },
    urls,
  };

  vi.stubGlobal("fetch", (input: string | URL | Request) => {
    urls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const step: FetchStep | undefined = steps.at(urls.length - 1);
    if (!step) {
      return Promise.reject(
        new Error(`Unscripted fetch call #${urls.length}: script only has ${steps.length} step(s)`),
      );
    }
    step.onCall?.();
    if ("throws" in step) {
      return Promise.reject(step.throws);
    }
    const raw = typeof step.body === "string" || step.body === undefined ? step.body : JSON.stringify(step.body);
    return Promise.resolve(new Response(raw ?? null, { status: step.status }));
  });

  return state;
}

/** Gemini 200 envelope whose first candidate carries `text`. */
export function geminiEnvelope(text: string) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

/** Hand-written valid Gemini answer for `days` days. Does not use production schemas or constants. */
export function validGeminiBody(days: number) {
  const plan = {
    city_recognized: true,
    days: Array.from({ length: days }, (_, i) => ({
      day_number: i + 1,
      points: [{ name: `Point ${i + 1}`, description: "A place worth seeing." }],
    })),
  };
  return geminiEnvelope(JSON.stringify(plan));
}
