import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/trips", "/api/trips"];
// Dev-only fixture pages (e.g. /dev/kitchen-sink): SSR would otherwise ship them to production.
const DEV_ONLY_PREFIX = "/dev/";

export const onRequest = defineMiddleware(async (context, next) => {
  if (!import.meta.env.DEV && context.url.pathname.startsWith(DEV_ONLY_PREFIX)) {
    return new Response(null, { status: 404 });
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

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      // API callers use fetch, which would silently follow a redirect to the HTML sign-in page.
      if (context.url.pathname.startsWith("/api/")) {
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
