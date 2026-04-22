import { redirect } from "next/navigation";

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const role = sp.role === "teacher" ? "teacher" : "student";
  redirect(`/${locale}?role=${role}`);
}
