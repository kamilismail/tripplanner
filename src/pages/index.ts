import type { APIRoute } from "astro";

export const prerender = false;

// "/" is never a page of its own: it sends the visitor where their session belongs.
// An endpoint rather than index.astro: a top-level `return` in .astro frontmatter crashes
// @typescript-eslint/no-misused-promises (no enclosing function).
export const GET: APIRoute = (context) => context.redirect(context.locals.user ? "/trips" : "/auth/signin");
