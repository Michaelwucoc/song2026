import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "access_denied" }, { status: 403 });

  const { id } = await params;
  const updated = await prisma.request.update({
    where: { id },
    data: { status: "played" },
  });
  return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
}

