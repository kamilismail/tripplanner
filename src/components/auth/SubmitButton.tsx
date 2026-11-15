import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface SubmitButtonProps {
  pending: boolean;
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
}

export function SubmitButton({ pending, pendingText, icon, children }: SubmitButtonProps) {
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-busy={pending || undefined}>
      {pending ? (
        <>
          <Spinner />
          {pendingText}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </Button>
  );
}
