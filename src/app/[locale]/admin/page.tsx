import { AdminClient } from "./AdminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AdminClient locale={locale} />;
}

