import { NextResponse } from "next/server";
import { adminCookie, buildAdminSessionToken } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) {
    return NextResponse.json(
      { error: "admin_password_not_configured" },
      { status: 500 },
    );
  }

  const password = String(body.password ?? "");
  if (password !== expected) {
    return NextResponse.json({ error: "invalid_password" }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookie.name, buildAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: adminCookie.maxAgeSeconds(),
  });
  return res;
}

