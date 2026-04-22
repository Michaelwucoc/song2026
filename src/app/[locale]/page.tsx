import { RequestClient } from "./request/RequestClient";

export default async function LocaleHome({
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const sp = await searchParams;
  const initialRole = sp.role === "teacher" ? "teacher" : "student";
  return <RequestClient initialRole={initialRole} />;
}
