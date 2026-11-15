import { z } from "zod";
import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

// Matches MIN_PASSWORD_LENGTH in src/components/auth/SignUpForm.tsx.
const MIN_PASSWORD_LENGTH = 6;

const signUpSchema = z.object({
  email: z.string().trim().pipe(z.email("Enter a valid email address")),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
});

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const { email, password } = parsed.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  // No session means the project requires email confirmation before the first sign-in.
  return context.redirect(data.session ? "/trips" : "/auth/confirm-email");
};
