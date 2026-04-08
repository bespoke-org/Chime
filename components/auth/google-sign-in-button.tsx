"use client";

import { useTransition } from "react";
import { LoaderCircle, LogIn } from "lucide-react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="w-full"
      size="lg"
      onClick={() =>
        startTransition(() => {
          void signIn("google", { callbackUrl: "/dashboard" });
        })
      }
    >
      {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
      Continue with Google
    </Button>
  );
}
