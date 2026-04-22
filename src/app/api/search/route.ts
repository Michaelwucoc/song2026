import { NextResponse } from "next/server";

export const runtime = "nodejs";

type NeteaseDirectSong = {
  id: number;
  name: string;
  artists?: Array<{ id: number; name: string }>;
  album?: { id: number; name: string; picUrl?: string };
};

type NeteaseDirectResponse = {
  result?: { songs?: NeteaseDirectSong[] };
  code?: number;
};

type NeteaseMiddlewareSong = {
  id: number;
  name: string;
  ar?: Array<{ id: number; name: string }>;
  al?: { id: number; name: string; picUrl?: string };
};

type NeteaseMiddlewareResponse = {
  result?: { songs?: NeteaseMiddlewareSong[] };
};

type NormalizedSong = {
  platform: "netease";
  platformSongId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
};

function toHttps(url: string) {
  if (!url) return "";
  if (url.startsWith("http://")) return "https://" + url.slice("http://".length);
  return url;
}

async function searchViaMiddleware(
  baseUrl: string,
  keyword: string,
): Promise<NormalizedSong[] | null> {
  const upstream = new URL("/cloudsearch", baseUrl);
  upstream.searchParams.set("keywords", keyword);
  upstream.searchParams.set("limit", "20");

  const res = await fetch(upstream.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as NeteaseMiddlewareResponse;
  return (
    data.result?.songs?.map((s) => ({
      platform: "netease" as const,
      platformSongId: String(s.id),
      title: s.name,
      artist: (s.ar ?? []).map((a) => a.name).join(", "),
      album: s.al?.name ?? "",
      coverUrl: toHttps(s.al?.picUrl ?? ""),
    })) ?? []
  );
}

async function searchDirect(keyword: string): Promise<NormalizedSong[] | null> {
  const url = new URL("https://music.163.com/api/search/get/web");
  url.searchParams.set("s", keyword);
  url.searchParams.set("type", "1");
  url.searchParams.set("offset", "0");
  url.searchParams.set("limit", "20");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      Referer: "https://music.163.com/",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as NeteaseDirectResponse;
  return (
    data.result?.songs?.map((s) => ({
      platform: "netease" as const,
      platformSongId: String(s.id),
      title: s.name,
      artist: (s.artists ?? []).map((a) => a.name).join(", "),
      album: s.album?.name ?? "",
      coverUrl: toHttps(s.album?.picUrl ?? ""),
    })) ?? []
  );
}

type NeteaseSongDetailResponse = {
  songs?: Array<{
    id: number;
    album?: { id: number; picUrl?: string };
  }>;
};

async function enrichCovers(songs: NormalizedSong[]): Promise<NormalizedSong[]> {
  const missing = songs.filter((s) => !s.coverUrl).map((s) => s.platformSongId);
  if (missing.length === 0) return songs;

  try {
    const url = new URL("https://music.163.com/api/song/detail");
    url.searchParams.set("ids", `[${missing.join(",")}]`);
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Referer: "https://music.163.com/",
      },
      cache: "no-store",
    });
    if (!res.ok) return songs;
    const data = (await res.json()) as NeteaseSongDetailResponse;
    const picById = new Map<string, string>();
    for (const s of data.songs ?? []) {
      const pic = toHttps(s.album?.picUrl ?? "");
      if (pic) picById.set(String(s.id), pic);
    }
    return songs.map((s) =>
      s.coverUrl || !picById.has(s.platformSongId)
        ? s
        : { ...s, coverUrl: picById.get(s.platformSongId) ?? "" },
    );
  } catch {
    return songs;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const keyword = (url.searchParams.get("keyword") ?? "").trim();

  if (!keyword) {
    return NextResponse.json({ error: "keyword_required" }, { status: 400 });
  }
  if (keyword.length > 100) {
    return NextResponse.json({ error: "keyword_too_long" }, { status: 400 });
  }

  const baseUrl = process.env.NETEASE_API_BASE_URL?.trim();

  try {
    if (baseUrl) {
      const songs = await searchViaMiddleware(baseUrl, keyword);
      if (songs) return NextResponse.json({ songs: await enrichCovers(songs) });
    }
    const direct = await searchDirect(keyword);
    if (direct) return NextResponse.json({ songs: await enrichCovers(direct) });
    return NextResponse.json({ error: "netease_api_failed" }, { status: 502 });
  } catch {
    return NextResponse.json(
      { error: "netease_api_unreachable" },
      { status: 502 },
    );
  }
}
