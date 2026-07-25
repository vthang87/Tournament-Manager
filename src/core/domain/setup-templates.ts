/**
 * Ready-made setup templates for match rules and stage pipelines.
 * Templates are data — UI/application applies them; users can edit afterward.
 */

export type MatchRuleTemplateFields = {
  name: string;
  bestOfSets: number;
  pointsToWin: number;
  winBy: number;
  maxPoints: number;
  deuceEnabled: boolean;
  decidingSetPoints: number | null;
  decidingSetWinBy: number | null;
  decidingSetMaxPoints: number | null;
  changeEndsEnabled: boolean;
  changeEndsAt: number | null;
};

export type StageTemplateFields = {
  /** Stable key used to link a rule within the same setup template. */
  ruleKey: string;
  type: string;
  name: string;
  format: "GROUP" | "KNOCKOUT";
  orderIndex: number;
};

export type MatchRulePreset = {
  id: string;
  /** i18n key under templates.rules.* */
  nameKey: string;
  descriptionKey: string;
  fields: MatchRuleTemplateFields;
};

export type EventSetupTemplate = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  /** Rules created (or reused by name) before stages. */
  rules: Array<{ key: string; fields: MatchRuleTemplateFields }>;
  /** Default event match rule key after apply. */
  defaultRuleKey: string;
  stages: StageTemplateFields[];
  thirdPlaceMatchEnabled?: boolean;
};

function rule(
  name: string,
  bestOfSets: number,
  pointsToWin: number,
  winBy: number,
  maxPoints: number,
): MatchRuleTemplateFields {
  return {
    name,
    bestOfSets,
    pointsToWin,
    winBy,
    maxPoints,
    deuceEnabled: true,
    decidingSetPoints: null,
    decidingSetWinBy: null,
    decidingSetMaxPoints: null,
    changeEndsEnabled: true,
    changeEndsAt: 11,
  };
}

/** Individual rule chips — apply one-by-one on the rules page. */
export const MATCH_RULE_PRESETS: MatchRulePreset[] = [
  {
    id: "group-bo1-21",
    nameKey: "ruleGroupBo121",
    descriptionKey: "ruleGroupBo121Desc",
    fields: rule("Vòng bảng — Best of 1 (21)", 1, 21, 2, 30),
  },
  {
    id: "knockout-bo3-15",
    nameKey: "ruleKnockoutBo315",
    descriptionKey: "ruleKnockoutBo315Desc",
    fields: rule("Knockout — Best of 3 (15)", 3, 15, 2, 21),
  },
  {
    id: "final-bo3-21",
    nameKey: "ruleFinalBo321",
    descriptionKey: "ruleFinalBo321Desc",
    fields: rule("Chung kết — Best of 3 (21)", 3, 21, 2, 30),
  },
  {
    id: "standard-bo3-21",
    nameKey: "ruleStandardBo321",
    descriptionKey: "ruleStandardBo321Desc",
    fields: rule("Tiêu chuẩn — Best of 3 (21)", 3, 21, 2, 30),
  },
];

const RULE_GROUP = rule("Vòng bảng — Best of 1 (21)", 1, 21, 2, 30);
const RULE_KO = rule("Knockout — Best of 3 (15)", 3, 15, 2, 21);
const RULE_FINAL = rule("Chung kết — Best of 3 (21)", 3, 21, 2, 30);
const RULE_STD = rule("Tiêu chuẩn — Best of 3 (21)", 3, 21, 2, 30);

/**
 * Full event setup packs: rules + stage pipeline in one click.
 */
export const EVENT_SETUP_TEMPLATES: EventSetupTemplate[] = [
  {
    id: "badminton-group-knockout",
    nameKey: "setupGroupKnockout",
    descriptionKey: "setupGroupKnockoutDesc",
    defaultRuleKey: "group",
    thirdPlaceMatchEnabled: true,
    rules: [
      { key: "group", fields: RULE_GROUP },
      { key: "knockout", fields: RULE_KO },
      { key: "final", fields: RULE_FINAL },
    ],
    stages: [
      {
        ruleKey: "group",
        type: "GROUP",
        name: "Vòng bảng",
        format: "GROUP",
        orderIndex: 0,
      },
      {
        ruleKey: "knockout",
        type: "KNOCKOUT",
        name: "Vòng loại trực tiếp",
        format: "KNOCKOUT",
        orderIndex: 1,
      },
    ],
  },
  {
    id: "group-only",
    nameKey: "setupGroupOnly",
    descriptionKey: "setupGroupOnlyDesc",
    defaultRuleKey: "group",
    rules: [{ key: "group", fields: RULE_GROUP }],
    stages: [
      {
        ruleKey: "group",
        type: "GROUP",
        name: "Vòng bảng",
        format: "GROUP",
        orderIndex: 0,
      },
    ],
  },
  {
    id: "knockout-only",
    nameKey: "setupKnockoutOnly",
    descriptionKey: "setupKnockoutOnlyDesc",
    defaultRuleKey: "knockout",
    thirdPlaceMatchEnabled: true,
    rules: [
      { key: "knockout", fields: RULE_KO },
      { key: "final", fields: RULE_FINAL },
    ],
    stages: [
      {
        ruleKey: "knockout",
        type: "KNOCKOUT",
        name: "Vòng loại trực tiếp",
        format: "KNOCKOUT",
        orderIndex: 0,
      },
    ],
  },
  {
    id: "standard-knockout",
    nameKey: "setupStandardKnockout",
    descriptionKey: "setupStandardKnockoutDesc",
    defaultRuleKey: "standard",
    thirdPlaceMatchEnabled: false,
    rules: [{ key: "standard", fields: RULE_STD }],
    stages: [
      {
        ruleKey: "standard",
        type: "KNOCKOUT",
        name: "Knockout",
        format: "KNOCKOUT",
        orderIndex: 0,
      },
    ],
  },
];

export function getMatchRulePreset(id: string): MatchRulePreset | undefined {
  return MATCH_RULE_PRESETS.find((p) => p.id === id);
}

export function getEventSetupTemplate(
  id: string,
): EventSetupTemplate | undefined {
  return EVENT_SETUP_TEMPLATES.find((t) => t.id === id);
}
