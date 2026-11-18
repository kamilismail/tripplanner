import { vi } from "vitest";

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
  while (!state.done) {
    await vi.advanceTimersByTimeAsync(1_500);
  }
  return outcome;
}
