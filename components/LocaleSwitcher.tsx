"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const localeLabels: Record<string, string> = {
    en: "English",
    ja: "日本語",
    zh: "中文",
  };

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Locale Switcher">
      {routing.locales.map((loc) => (
        <Button
          key={loc}
          variant={locale === loc ? "default" : "ghost"}
          size="sm"
          onClick={() => router.replace(pathname, { locale: loc })}
          className={cn(locale === loc && "pointer-events-none")}
          aria-current={locale === loc ? "true" : undefined}
        >
          {localeLabels[loc] ?? loc}
        </Button>
      ))}
    </div>
  );
}
