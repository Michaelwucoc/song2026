import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST() {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "access_denied" }, { status: 403 });

  const res = await prisma.request.updateMany({
    where: { status: "played" },
    data: { status: "removed" },
  });

  return NextResponse.json({ ok: true, cleared: res.count });
}

