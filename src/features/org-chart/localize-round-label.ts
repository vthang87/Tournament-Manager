type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/**
 * Engine round labels (`roundLabelFromStructure`) are structural English strings.
 * Map them onto `orgChart.round.*` for display.
 */
export function localizeRoundLabel(label: string, t: Translate): string {
  switch (label) {
    case "Final":
      return t("round.final");
    case "Semifinals":
      return t("round.semifinals");
    case "Quarterfinals":
      return t("round.quarterfinals");
    case "3rd Place":
      return t("thirdPlace");
    default:
      break;
  }
  const roundOf = /^Round of (\d+)$/.exec(label);
  if (roundOf) {
    return t("round.roundOf", { size: Number(roundOf[1]) });
  }
  return label;
}
