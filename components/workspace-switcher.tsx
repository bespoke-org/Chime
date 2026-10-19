"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setActiveWorkspaceAction } from "@/app/(creator)/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import type { CreatorWorkspaceOption } from "@/lib/form-types";

// Not a workspace: picking it opens the settings section with the create form.
const CREATE_WORKSPACE_VALUE = "create";

export function WorkspaceSwitcher({
  options,
  activeValue,
}: {
  options: CreatorWorkspaceOption[];
  activeValue: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { t } = useI18n();
  const selectKey = options
    .map(
      (option) =>
        `${option.value}:${option.label}:${option.kind === "organization" && option.isOwner ? "owner" : "member"}`,
    )
    .join("|");

  return (
    <Select
      key={selectKey}
      value={activeValue}
      disabled={isPending}
      onValueChange={(value) => {
        if (value === CREATE_WORKSPACE_VALUE) {
          router.push("/settings?section=organizations");
          return;
        }

        const formData = new FormData();
        formData.set("workspace", value);

        startTransition(async () => {
          await setActiveWorkspaceAction(formData);
          router.refresh();
        });
      }}
    >
      <SelectTrigger
        aria-label={t("workspace.selectAria")}
        className={cn("min-w-[168px]", isPending && "opacity-70")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.kind === "personal"
              ? t("workspace.personal")
              : option.label}
            {option.kind === "organization" && option.isOwner
              ? ` · ${t("workspace.ownerSuffix")}`
              : ""}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={CREATE_WORKSPACE_VALUE}>
          {t("workspace.create")}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
