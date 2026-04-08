"use client";

import { useTransition } from "react";
import { LoaderCircle, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() =>
        startTransition(() => {
          void signOut({ callbackUrl: "/" });
        })
      }
    >
      {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      Sign out
    </Button>
  );
}
