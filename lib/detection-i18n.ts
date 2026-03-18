/**
 * Detection i18n helpers for face-api results.
 * Use with next-intl: pass the t function from useTranslations("Detection").
 *
 * - Labels: t("genderLabel"), t("ageLabel"), t("expressionLabel"), t("ageSuffix")
 * - Gender: t("male") / t("female")
 * - Expressions: t("neutral"), t("happy"), etc.
 * - For raw expression strings like "neutral 85%, happy 12%", use translateExpressionString.
 */

export type TranslateFn = (key: string) => string;

const EXPRESSION_EMOJI_MAP: Record<string, string> = {
  neutral: "😐",
  happy: "🙂",
  sad: "😢",
  angry: "😠",
  fearful: "😨",
  disgusted: "🤢",
  surprised: "😮",
};

/**
 * Parses strings like "neutral 85%" or "neutral 85%, happy 12%" and replaces
 * the expression name with an emoji while keeping the percent.
 *
 * Output format: "<emoji> <pct>".
 * Unknown keys: "❓ <pct>".
 */
export function formatExpressionStringWithEmoji(str: string): string {
  const parts = str.split(/,\s*/);
  return parts
    .map((part) => {
      const match = part.match(/^(\S+)\s+(\d+%)$/);
      if (!match) return part;
      const [, key, pct] = match;
      const emoji = EXPRESSION_EMOJI_MAP[key.toLowerCase()] ?? "❓";
      return `${emoji} ${pct}`;
    })
    .join(", ");
}

/**
 * Parses strings like "neutral 85%" or "neutral 85%, happy 12%", translates
 * the expression key via t() and keeps the " N%" part. Joins multiple with ", ".
 */
export function translateExpressionString(
  str: string,
  t: TranslateFn,
): string {
  const parts = str.split(/,\s*/);
  return parts
    .map((part) => {
      const match = part.match(/^(\S+)\s+(\d+%)$/);
      if (!match) return part;
      const [, key, pct] = match;
      const k = key.toLowerCase();
      const translated = t(k);
      return `${translated ?? key} ${pct}`;
    })
    .join(", ");
}
