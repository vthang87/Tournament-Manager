/** Known seed / English stage display names → `stages.name.*` keys. */
const KNOWN_STAGE_NAMES: Record<string, string> = {
  "Group Stage": "name.groupStage",
  "Knockout": "name.knockout",
  "Round of 16": "name.roundOf16",
  "Quarterfinal": "name.quarterfinal",
  "Semifinal": "name.semifinal",
  "Final": "name.final",
  "Third Place": "name.thirdPlace",
};

type Translate = (key: string) => string;

export function localizeStageName(
  name: string | null | undefined,
  t: Translate,
): string {
  if (!name) {
    return "";
  }
  const key = KNOWN_STAGE_NAMES[name];
  return key ? t(key) : name;
}
