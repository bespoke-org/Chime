"use client";

import { useState } from "react";

import { deleteOrganizationAction } from "@/app/(creator)/actions";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DeleteOrganizationButton({
  organizationId,
  returnOrganizationId,
}: {
  organizationId: string;
  returnOrganizationId: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const formId = `delete-organization-${organizationId}`;

  return (
    <form id={formId} action={deleteOrganizationAction} className="mt-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="returnOrganizationId" value={returnOrganizationId} />
      <Button variant="danger" type="button" onClick={() => setOpen(true)}>
        {t("settings.organizations.deleteOrganization")}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("settings.organizations.deleteOrganizationTitle")}
        description={t("settings.organizations.deleteOrganizationConfirmDescription")}
        confirmLabel={t("ui.delete")}
        cancelLabel={t("ui.cancel")}
        actions={
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              {t("ui.cancel")}
            </Button>
            <Button variant="danger" type="submit" form={formId}>
              {t("ui.delete")}
            </Button>
          </div>
        }
      />
    </form>
  );
}
