"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  applyRulePresetAction,
  applySetupTemplateAction,
} from "@/features/stages/actions";
import type {
  EventSetupTemplate,
  MatchRulePreset,
} from "@/core/domain/setup-templates";

export function SetupTemplatesPanel({
  tournamentId,
  eventId,
  hasStages,
  mode,
  templates,
  rulePresets,
}: {
  tournamentId: string;
  eventId: string;
  hasStages: boolean;
  mode: "full" | "rules" | "stages";
  templates: EventSetupTemplate[];
  rulePresets: MatchRulePreset[];
}) {
  const t = useTranslations("templates");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyTemplate(templateId: string, replace: boolean) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await applySetupTemplateAction(
        tournamentId,
        eventId,
        templateId,
        replace,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        t("appliedSetup", {
          rules: result.data.rulesCreated,
          stages: result.data.stagesCreated,
          replaced: result.data.replacedStages,
        }),
      );
      router.refresh();
    });
  }

  function applyRule(presetId: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await applyRulePresetAction(
        tournamentId,
        eventId,
        presetId,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        result.data.created ? t("ruleCreated") : t("ruleAlreadyExists"),
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {(mode === "full" || mode === "stages") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("setupTitle")}</CardTitle>
            <CardDescription>{t("setupHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {t(tpl.nameKey as "setupGroupKnockout")}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {t(tpl.descriptionKey as "setupGroupKnockoutDesc")}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  {!hasStages ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => applyTemplate(tpl.id, false)}
                    >
                      {t("apply")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        if (
                          window.confirm(t("replaceConfirm"))
                        ) {
                          applyTemplate(tpl.id, true);
                        }
                      }}
                    >
                      {t("replaceApply")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(mode === "full" || mode === "rules") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("rulesTitle")}</CardTitle>
            <CardDescription>{t("rulesHint")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {rulePresets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                title={t(preset.descriptionKey as "ruleGroupBo121Desc")}
                onClick={() => applyRule(preset.id)}
              >
                {t(preset.nameKey as "ruleGroupBo121")}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700">{message}</p>
      ) : null}
    </div>
  );
}
