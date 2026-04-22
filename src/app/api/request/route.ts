import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCooldownRemainingSeconds, setCooldownIfNotExists } from "@/lib/cooldown";

export const runtime = "nodejs";

const USER_COOKIE = "sr_user_id";

type RequestSongInput = {
  platform: "netease";
  platformSongId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
};

type Body = {
  role?: "student" | "teacher";
  name?: string;
  song: RequestSongInput;
};

function normalizeName(raw: unknown) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 40);
  if (!trimmed) return null;
  return trimmed;
}

function getCooldownSeconds() {
  const raw = Number(process.env.USER_COOLDOWN_SECONDS ?? "300");
  if (!Number.isFinite(raw) || raw <= 0) return 300;
  return Math.min(Math.floor(raw), 24 * 60 * 60);
}

function normalizeSongInput(song: RequestSongInput) {
  const platformSongId = String(song.platformSongId ?? "").trim();
  const title = String(song.title ?? "").trim();
  const artist = String(song.artist ?? "").trim();
  const album = String(song.album ?? "").trim();
  const coverUrl = String(song.coverUrl ?? "").trim();

  if (!platformSongId || !title) return null;
  return {
    platform: "netease" as const,
    platformSongId,
    title,
    artist,
    album,
    coverUrl,
  };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const role = body.role === "teacher" ? "teacher" : "student";
  const name = normalizeName(body.name);
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  const songInput = body.song ? normalizeSongInput(body.song) : null;
  if (!songInput) {
    return NextResponse.json({ error: "invalid_song" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const existingUserId = cookieStore.get(USER_COOKIE)?.value;
  const userId = existingUserId && existingUserId.length > 10 ? existingUserId : null;

  const cooldownKey = `cooldown:user:${userId ?? "new"}`;
  const remaining = await getCooldownRemainingSeconds(cooldownKey);
  if (remaining > 0) {
    return NextResponse.json(
      { error: "cooldown", retryAfterSeconds: remaining },
      { status: 429 },
    );
  }

  const cooldownSeconds = getCooldownSeconds();

  const user =
    userId
      ? await prisma.user.upsert({
          where: { id: userId },
          update: { role, name },
          create: { id: userId, role, name },
        })
      : await prisma.user.create({ data: { role, name } });

  const ok = await setCooldownIfNotExists(`cooldown:user:${user.id}`, cooldownSeconds);
  if (!ok) {
    const retryAfterSeconds = await getCooldownRemainingSeconds(
      `cooldown:user:${user.id}`,
    );
    return NextResponse.json(
      { error: "cooldown", retryAfterSeconds },
      { status: 429 },
    );
  }

  const song = await prisma.song.upsert({
    where: {
      platform_platformSongId: {
        platform: songInput.platform,
        platformSongId: songInput.platformSongId,
      },
    },
    update: {
      title: songInput.title,
      artist: songInput.artist,
      album: songInput.album,
      coverUrl: songInput.coverUrl,
    },
    create: songInput,
  });

  const request = await prisma.request.create({
    data: {
      userId: user.id,
      songId: song.id,
      status: "queued",
    },
    include: { song: true },
  });

  const res = NextResponse.json({
    request: {
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
      song: request.song,
    },
    cooldownEndsAtMs: Date.now() + cooldownSeconds * 1000,
  });

  if (!userId) {
    res.cookies.set(USER_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return res;
}

