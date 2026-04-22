import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/adminAuth";

export const runtime = "nodejs";

const USER_COOKIE = "sr_user_id";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawScope = url.searchParams.get("scope") ?? "mine";
  const scope: "admin" | "all" | "mine" | "public" =
    rawScope === "admin"
      ? "admin"
      : rawScope === "all"
        ? "all"
        : rawScope === "public"
          ? "public"
          : "mine";

  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_COOKIE)?.value ?? null;

  if (scope === "public") {
    const [queued, played] = await Promise.all([
      prisma.request.findMany({
        where: { status: "queued" },
        orderBy: { createdAt: "asc" },
        take: 100,
        include: { song: true, user: true },
      }),
      prisma.request.findMany({
        where: { status: "played" },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { song: true, user: true },
      }),
    ]);
    const mapItem = (r: (typeof queued)[number]) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      user: { role: r.user.role, name: r.user.name ?? null },
      song: {
        id: r.song.id,
        title: r.song.title,
        artist: r.song.artist,
        album: r.song.album,
        coverUrl: r.song.coverUrl,
        platform: r.song.platform,
        platformSongId: r.song.platformSongId,
      },
    });
    return NextResponse.json({
      queued: queued.map(mapItem),
      played: played.map(mapItem),
    });
  }

  if (scope === "mine") {
    if (!userId) return NextResponse.json({ requests: [] });
    const requests = await prisma.request.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { song: true },
    });
    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        song: r.song,
      })),
    });
  }

  const isAdmin = await verifyAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "access_denied" }, { status: 403 });
  }

  const [queuedAll, playedAll] = await Promise.all([
    prisma.request.findMany({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: { song: true, user: true },
    }),
    prisma.request.findMany({
      where: { status: "played" },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { song: true, user: true },
    }),
  ]);

  const mapAdmin = (r: (typeof queuedAll)[number]) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
    user: { id: r.userId, role: r.user.role, name: r.user.name ?? null },
    song: r.song,
  });

  return NextResponse.json({
    queued: queuedAll.map(mapAdmin),
    played: playedAll.map(mapAdmin),
    requests: queuedAll.map(mapAdmin),
  });
}

