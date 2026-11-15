import { z } from "zod";
import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const signInSchema = z.object({
  email: z.string().trim().pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Password is required"),
});

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const parsed = signInSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const { email, password } = parsed.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/trips");
};
