import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/i18n/I18nContext";
import { getMessages } from "@/i18n/getMessages";
import { isLocale, locales, type Locale } from "@/i18n/locales";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const messages = (await getMessages(locale as Locale)) as {
    appName?: string;
    header?: { admin?: string };
  };
  const appName = messages.appName ?? "Song Request";
  const adminLabel = messages.header?.admin ?? "Admin";

  return (
    <I18nProvider locale={locale} messages={messages}>
      <div className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/60">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link
              href={`/${locale}`}
              className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              {appName}
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link
                href={`/${locale}/admin`}
                className="rounded-full border border-black/10 px-3 py-1.5 text-zinc-800 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/10"
              >
                {adminLabel}
              </Link>
              <div className="flex items-center overflow-hidden rounded-full border border-black/10 dark:border-white/15">
                <Link
                  href={`/zh${stripLocalePath(`/${locale}`)}`}
                  className={`px-3 py-1.5 ${locale === "zh" ? "bg-zinc-900 text-white dark:bg-white dark:text-black" : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-white/10"}`}
                >
                  中文
                </Link>
                <Link
                  href={`/en${stripLocalePath(`/${locale}`)}`}
                  className={`px-3 py-1.5 ${locale === "en" ? "bg-zinc-900 text-white dark:bg-white dark:text-black" : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-white/10"}`}
                >
                  EN
                </Link>
              </div>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </I18nProvider>
  );
}

function stripLocalePath(pathname: string) {
  // pathname format we generate: "/{locale}" only for now.
  // When we add more pages, we can replace this with a smarter segment swap.
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "/";
  if (parts[0] === "zh" || parts[0] === "en") {
    return "/" + parts.slice(1).join("/");
  }
  return "/" + parts.join("/");
}

