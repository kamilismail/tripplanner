import { vi } from "vitest";

const MAX_STEPS = 100;

/** Resolves the call under test while stepping the fake clock through retry delays. */
export async function settle<T>(call: T | Promise<T>) {
  const promise = Promise.resolve(call);
  const state = { done: false };
  const outcome = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  void outcome.finally(() => {
    state.done = true;
  });
  // Bounded so a call that never settles fails here instead of looping in the background.
  for (let step = 0; !state.done; step++) {
    if (step >= MAX_STEPS) {
      throw new Error(`Call did not settle after ${MAX_STEPS} fake-clock steps`);
    }
    await vi.advanceTimersByTimeAsync(1_500);
  }
  return outcome;
}
