import { LoadingShell } from "@/components/loading-shell";
import { getRequestI18n } from "@/lib/i18n-server";

export default async function PublicFormLoading() {
  const { t } = await getRequestI18n();

  return <LoadingShell label={t("loading.page", { title: t("loading.titles.publicForm") })} />;
}
