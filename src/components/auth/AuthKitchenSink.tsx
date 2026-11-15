import React from "react";
import SignInForm from "@/components/auth/SignInForm";
import SignUpForm from "@/components/auth/SignUpForm";
import { Cell, Section } from "@/components/trips/KitchenSink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Fixtures only: every form runs in `demo` mode, so submitting never posts or navigates.

const EMAIL = "traveller@example.com";
const PASSWORD = "correct-horse";

/** The auth card frame (same width as AuthCard.astro), so the forms render as on the real page. */
function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle role="heading" aria-level={3} className="text-xl">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Dev-only visual gate: every state of the sign-in and sign-up forms. */
export default function AuthKitchenSink() {
  return (
    <div className="space-y-10">
      <Section title="Sign-in form" note="Empty: N/A, the form always renders. Submitting here never posts.">
        <Cell label="Default">
          <AuthFrame title="Sign in">
            <SignInForm demo />
          </AuthFrame>
        </Cell>
        <Cell label="Field error">
          <AuthFrame title="Sign in">
            <SignInForm
              demo
              initialValues={{ email: "traveller@", password: "" }}
              initialErrors={{ email: "Enter a valid email address", password: "Password is required" }}
            />
          </AuthFrame>
        </Cell>
        <Cell label="Loading / disabled">
          <AuthFrame title="Sign in">
            <SignInForm demo forcePending initialValues={{ email: EMAIL, password: PASSWORD }} />
          </AuthFrame>
        </Cell>
        <Cell label="Error (server)">
          <AuthFrame title="Sign in">
            <SignInForm
              demo
              initialValues={{ email: EMAIL, password: PASSWORD }}
              serverError="Invalid login credentials"
            />
          </AuthFrame>
        </Cell>
        <Cell label="Password visible">
          <AuthFrame title="Sign in">
            <SignInForm demo initialShowPassword initialValues={{ email: EMAIL, password: PASSWORD }} />
          </AuthFrame>
        </Cell>
      </Section>

      <Section title="Sign-up form" note="Empty: N/A, the form always renders. Submitting here never posts.">
        <Cell label="Default">
          <AuthFrame title="Create account">
            <SignUpForm demo />
          </AuthFrame>
        </Cell>
        <Cell label="Field error (password mismatch)">
          <AuthFrame title="Create account">
            <SignUpForm
              demo
              initialValues={{ email: EMAIL, password: PASSWORD, confirmPassword: "correct-hose" }}
              initialErrors={{ confirmPassword: "Passwords do not match" }}
            />
          </AuthFrame>
        </Cell>
        <Cell label="Hint (password length)">
          <AuthFrame title="Create account">
            <SignUpForm demo initialValues={{ email: EMAIL, password: "abc" }} />
          </AuthFrame>
        </Cell>
        <Cell label="Loading / disabled">
          <AuthFrame title="Create account">
            <SignUpForm
              demo
              forcePending
              initialValues={{ email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD }}
            />
          </AuthFrame>
        </Cell>
        <Cell label="Error (server)">
          <AuthFrame title="Create account">
            <SignUpForm
              demo
              initialValues={{ email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD }}
              serverError="User already registered"
            />
          </AuthFrame>
        </Cell>
      </Section>
    </div>
  );
}
