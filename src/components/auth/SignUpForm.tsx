import React, { useId, useState } from "react";
import { Mail, Lock, UserPlus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { usePendingSubmit } from "@/components/hooks/usePendingSubmit";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";

interface Fields {
  email?: string;
  password?: string;
  confirmPassword?: string;
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

export default function SignUpForm({
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
  const [confirmPassword, setConfirmPassword] = useState(initialValues?.confirmPassword ?? "");
  const [showPassword, setShowPassword] = useState(initialShowPassword);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (!confirmPassword) {
      next.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
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

  const passwordHint =
    !errors.password && password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? (
      <p className="text-muted-foreground mt-1 text-xs">
        {MIN_PASSWORD_LENGTH - password.length} more character
        {MIN_PASSWORD_LENGTH - password.length !== 1 ? "s" : ""} needed
      </p>
    ) : undefined;

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4" onSubmit={handleSubmit} noValidate>
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
        placeholder="Min. 6 characters"
        autoComplete="new-password"
        error={errors.password}
        hint={passwordHint}
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

      <FormField
        id={`${uid}-confirmPassword`}
        name="confirmPassword"
        label="Confirm password"
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder="Re-enter your password"
        autoComplete="new-password"
        error={errors.confirmPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
          />
        }
      />

      <ServerError message={serverError} />

      <SubmitButton
        pending={forcePending || submitting}
        pendingText="Creating account..."
        icon={<UserPlus className="size-4" />}
      >
        Create account
      </SubmitButton>
    </form>
  );
}
