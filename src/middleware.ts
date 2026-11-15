import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/trips", "/api/trips"];
// Pages a signed-in user has no use for; exact paths, so /api/auth/* (the form POST targets) is never caught.
const GUEST_ONLY_ROUTES = ["/auth/signin", "/auth/signup"];
// Dev-only fixture pages (e.g. /dev/kitchen-sink): SSR would otherwise ship them to production.
const DEV_ONLY_PREFIX = "/dev/";

export const onRequest = defineMiddleware(async (context, next) => {
  if (!import.meta.env.DEV && context.url.pathname.startsWith(DEV_ONLY_PREFIX)) {
    return context.rewrite("/404");
  }

  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  // Runs after the user is resolved: the redirect depends on the session.
  const normalizedPath =
    context.url.pathname.length > 1 ? context.url.pathname.replace(/\/+$/, "") : context.url.pathname;
  if (context.locals.user && GUEST_ONLY_ROUTES.includes(normalizedPath)) {
    return context.redirect("/trips");
  }

  if (PROTECTED_ROUTES.some((route) => normalizedPath.startsWith(route))) {
    if (!context.locals.user) {
      // API callers use fetch, which would silently follow a redirect to the HTML sign-in page.
      if (normalizedPath.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
