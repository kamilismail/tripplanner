import React, { useId, useState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { usePendingSubmit } from "@/components/hooks/usePendingSubmit";

interface Fields {
  email?: string;
  password?: string;
}

interface Props {
  serverError?: string | null;
  // Kitchen-sink fixtures only: they seed the initial state. Production pages pass none of them.
  initialValues?: Fields;
  initialErrors?: Fields;
  initialShowPassword?: boolean;
  forcePending?: boolean;
  /** Never posts: submit is always prevented (validation still runs). */
  demo?: boolean;
}

export default function SignInForm({
  serverError,
  initialValues,
  initialErrors,
  initialShowPassword = false,
  forcePending = false,
  demo = false,
}: Props) {
  const uid = useId();
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [password, setPassword] = useState(initialValues?.password ?? "");
  const [showPassword, setShowPassword] = useState(initialShowPassword);
  const [errors, setErrors] = useState<Fields>(initialErrors ?? {});
  const [submitting, startSubmitting] = usePendingSubmit();

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Enter a valid email address";
    }
    if (!password) {
      next.password = "Password is required";
    }
    setErrors(next);
    return Object.keys(next) as (keyof typeof errors)[];
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (demo) e.preventDefault();
    const invalid = validate();
    if (invalid.length > 0) {
      e.preventDefault();
      // Move focus to the first invalid field once its error is rendered, so screen readers announce it.
      const form = e.currentTarget;
      setTimeout(() => {
        form.querySelector<HTMLInputElement>(`[name="${invalid[0]}"]`)?.focus();
      }, 0);
      return;
    }
    if (!demo) startSubmitting();
  }

  return (
    <form method="POST" action="/api/auth/signin" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id={`${uid}-email`}
        name="email"
        type="email"
        label="Email"
        value={email}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder="you@example.com"
        autoComplete="email"
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <FormField
        id={`${uid}-password`}
        name="password"
        label="Password"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder="Your password"
        autoComplete="current-password"
        error={errors.password}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />

      <ServerError message={serverError} />

      <SubmitButton
        pending={forcePending || submitting}
        pendingText="Signing in..."
        icon={<LogIn className="size-4" />}
      >
        Sign in
      </SubmitButton>
    </form>
  );
}
