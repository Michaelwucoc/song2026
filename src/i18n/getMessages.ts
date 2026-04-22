import type { Locale } from "./locales";

export async function getMessages(locale: Locale) {
  if (locale === "zh") {
    return (await import("../../messages/zh.json")).default;
  }
  return (await import("../../messages/en.json")).default;
}

