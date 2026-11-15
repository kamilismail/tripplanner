import { useCallback, useEffect, useState } from "react";

/**
 * Pending state for a native (non-fetch) form submit.
 * Back/Forward can restore the page from bfcache with the button still pending,
 * so the state resets on a persisted `pageshow`.
 */
export function usePendingSubmit(): [pending: boolean, start: () => void] {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) setPending(false);
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const start = useCallback(() => {
    setPending(true);
  }, []);

  return [pending, start];
}
