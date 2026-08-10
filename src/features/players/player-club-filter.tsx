"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SearchableSelect } from "@/components/ui/searchable-select";

export function PlayerClubFilter({
  defaultValue,
  clubs,
  className,
}: {
  defaultValue: string;
  clubs: Array<{ id: string; name: string; shortName?: string | null }>;
  className?: string;
}) {
  const t = useTranslations("players");
  const [value, setValue] = useState(defaultValue);

  return (
    <SearchableSelect
      name="clubId"
      value={value}
      onChange={setValue}
      options={clubs.map((club) => ({
        value: club.id,
        label: club.name,
        hint: club.shortName ?? undefined,
      }))}
      placeholder={t("allClubs")}
      searchPlaceholder={t("searchClubs")}
      emptyText={t("noClubsFound")}
      className={className}
    />
  );
}
