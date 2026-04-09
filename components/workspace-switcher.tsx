"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setActiveWorkspaceAction } from "@/app/(creator)/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CreatorWorkspaceOption } from "@/lib/form-types";

export function WorkspaceSwitcher({
  options,
  activeValue,
}: {
  options: CreatorWorkspaceOption[];
  activeValue: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const selectKey = options
    .map((option) => `${option.value}:${option.label}:${option.kind === "organization" && option.isOwner ? "owner" : "member"}`)
    .join("|");

  return (
    <Select
      key={selectKey}
      value={activeValue}
      disabled={isPending}
      onValueChange={(value) => {
        const formData = new FormData();
        formData.set("workspace", value);

        startTransition(async () => {
          await setActiveWorkspaceAction(formData);
          router.refresh();
        });
      }}
    >
      <SelectTrigger
        aria-label="Select workspace"
        className={cn("min-w-[168px]", isPending && "opacity-70")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
            {option.kind === "organization" && option.isOwner ? " · Owner" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
