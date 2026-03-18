import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { FaceApiWebcamDemo } from "@/components/face/FaceApiWebcamDemo";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("HomePage");

  return (
    <main className="w-full max-w-6xl mx-auto p-0 sm:p-10 pt-16">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-mono text-[0.9em]">{t("description")}</span>
        </p>
      </header>

      <FaceApiWebcamDemo />
    </main>
  );
}
