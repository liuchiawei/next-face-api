/**
 * Detection info i18n: labels, gender, and expression keys for face-api results.
 * No external i18n dependency; extend by adding locale entries.
 */

export type DetectionLocale = "ja" | "zh" | "en";

type DetectionLabels = {
  genderLabel: string;
  ageLabel: string;
  expressionLabel: string;
  ageSuffix: string;
};

const LABELS: Record<DetectionLocale, DetectionLabels> = {
  ja: {
    genderLabel: "性別",
    ageLabel: "年齢",
    expressionLabel: "表情",
    ageSuffix: "歳",
  },
  zh: {
    genderLabel: "性別",
    ageLabel: "年齡",
    expressionLabel: "表情",
    ageSuffix: "才",
  },
  en: {
    genderLabel: "Gender",
    ageLabel: "Age",
    expressionLabel: "Expression",
    ageSuffix: "y",
  },
};

const GENDER_MAP: Record<DetectionLocale, Record<string, string>> = {
  ja: { male: "男性", female: "女性" },
  zh: { male: "男", female: "女" },
  en: { male: "Male", female: "Female" },
};

const EXPRESSION_MAP: Record<DetectionLocale, Record<string, string>> = {
  ja: {
    neutral: "無表情",
    happy: "幸せ",
    sad: "悲しい",
    angry: "怒り",
    fearful: "恐れ",
    disgusted: "嫌悪",
    surprised: "驚き",
  },
  zh: {
    neutral: "中性",
    happy: "開心",
    sad: "悲傷",
    angry: "生氣",
    fearful: "恐懼",
    disgusted: "厭惡",
    surprised: "驚訝",
  },
  en: {
    neutral: "Neutral",
    happy: "Happy",
    sad: "Sad",
    angry: "Angry",
    fearful: "Fearful",
    disgusted: "Disgusted",
    surprised: "Surprised",
  },
};

export function getDetectionLabels(locale: DetectionLocale): DetectionLabels {
  return LABELS[locale];
}

export function translateGender(gender: string, locale: DetectionLocale): string {
  const key = gender.toLowerCase();
  const translated = GENDER_MAP[locale][key];
  return translated ?? gender;
}

export function translateExpressionKey(
  key: string,
  locale: DetectionLocale,
): string {
  const k = key.toLowerCase();
  const translated = EXPRESSION_MAP[locale][k];
  return translated ?? key;
}

/**
 * Parses strings like "neutral 85%" or "neutral 85%, happy 12%", translates
 * the expression key and keeps the " N%" part. Joins multiple with ", ".
 */
export function translateExpressionString(
  str: string,
  locale: DetectionLocale,
): string {
  const parts = str.split(/,\s*/);
  return parts
    .map((part) => {
      const match = part.match(/^(\S+)\s+(\d+%)$/);
      if (!match) return part;
      const [, key, pct] = match;
      return `${translateExpressionKey(key, locale)} ${pct}`;
    })
    .join(", ");
}
