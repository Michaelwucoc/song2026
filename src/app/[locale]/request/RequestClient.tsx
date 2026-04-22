"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n/I18nContext";

type Song = {
  platform: "netease";
  platformSongId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
};

type Role = "student" | "teacher";

type QueueItem = {
  id: string;
  status: "queued" | "played";
  createdAt: string;
  user: { role: Role; name: string | null };
  song: Song & { id: string };
};

type QueueFilter = "all" | "student" | "teacher";

export function RequestClient({
  initialRole = "student",
}: {
  initialRole?: Role;
}) {
  const t = useT();
  const [role, setRole] = useState<Role>(initialRole);
  const [keyword, setKeyword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selected, setSelected] = useState<Song | null>(null);
  const [selectedAt, setSelectedAt] = useState<number | null>(null);
  const [cooldownEndsAtMs, setCooldownEndsAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [lastRequestedTitle, setLastRequestedTitle] = useState<string | null>(null);
  const [queued, setQueued] = useState<QueueItem[]>([]);
  const [played, setPlayed] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("sr_user_name");
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setName(saved);
      }
      const savedRole = window.localStorage.getItem("sr_user_role");
      if (savedRole === "student" || savedRole === "teacher") {
        setRole(savedRole);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (name.trim()) {
        window.localStorage.setItem("sr_user_name", name.trim());
      }
    } catch {
      // ignore
    }
  }, [name]);

  useEffect(() => {
    try {
      window.localStorage.setItem("sr_user_role", role);
    } catch {
      // ignore
    }
  }, [role]);

  async function loadQueue() {
    setQueueLoading(true);
    try {
      const res = await fetch("/api/requests?scope=public", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { queued: QueueItem[]; played: QueueItem[] };
      setQueued(json.queued ?? []);
      setPlayed(json.played ?? []);
    } catch {
      // ignore
    } finally {
      setQueueLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
    const id = window.setInterval(() => {
      void loadQueue();
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  async function onSearch() {
    const k = keyword.trim();
    if (!k) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?keyword=${encodeURIComponent(k)}`, {
        method: "GET",
      });
      const json = (await res.json()) as { songs?: Song[]; error?: string };
      if (!res.ok) {
        setSongs([]);
        setError(json.error ?? "search_failed");
        return;
      }
      setSongs(json.songs ?? []);
      setSelected(null);
      setSelectedAt(null);
    } catch {
      setSongs([]);
      setError("network_error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!cooldownEndsAtMs) return;
    const tick = () => {
      setNowMs(Date.now());
      if (cooldownEndsAtMs <= Date.now()) setCooldownEndsAtMs(null);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [cooldownEndsAtMs]);

  const cooldownRemaining = useMemo(() => {
    if (!cooldownEndsAtMs) return 0;
    return Math.max(0, Math.ceil((cooldownEndsAtMs - nowMs) / 1000));
  }, [cooldownEndsAtMs, nowMs]);

  async function onRequestSong() {
    if (!selected) return;
    if (cooldownRemaining > 0) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setRequestError(t("request.nameRequired"));
      return;
    }
    setRequestError(null);
    setRequesting(true);
    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          name: trimmedName,
          song: selected,
        }),
      });
      const json = (await res.json()) as
        | { cooldownEndsAtMs: number }
        | { error: string; retryAfterSeconds?: number };
      if (!res.ok) {
        if ("retryAfterSeconds" in json && typeof json.retryAfterSeconds === "number") {
          setCooldownEndsAtMs(Date.now() + json.retryAfterSeconds * 1000);
        }
        setRequestError("error" in json ? json.error : "request_failed");
        return;
      }
      if ("cooldownEndsAtMs" in json && typeof json.cooldownEndsAtMs === "number") {
        setCooldownEndsAtMs(json.cooldownEndsAtMs);
      }
      setLastRequestedTitle(selected.title);
      setSelected(null);
      setSelectedAt(null);
      void loadQueue();
    } catch {
      setRequestError("network_error");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("request.title")}
          </h1>
          <div
            role="tablist"
            aria-label={t("request.title")}
            className="inline-flex items-center overflow-hidden rounded-full border border-black/10 bg-white dark:border-white/15 dark:bg-zinc-950"
          >
            <button
              role="tab"
              aria-selected={role === "student"}
              onClick={() => setRole("student")}
              className={`px-4 py-1.5 text-sm ${role === "student" ? "bg-zinc-900 text-white dark:bg-white dark:text-black" : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-white/10"}`}
            >
              {t("request.identityStudent")}
            </button>
            <button
              role="tab"
              aria-selected={role === "teacher"}
              onClick={() => setRole("teacher")}
              className={`px-4 py-1.5 text-sm ${role === "teacher" ? "bg-zinc-900 text-white dark:bg-white dark:text-black" : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-white/10"}`}
            >
              {t("request.identityTeacher")}
            </button>
          </div>
        </div>

        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t("request.nameLabel")}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="h-11 w-full rounded-2xl border border-black/10 bg-transparent px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:border-white/10 dark:text-zinc-100 dark:focus:ring-white/20"
                placeholder={t("request.namePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t("request.searchPlaceholder")}
              </label>
              <div className="flex gap-2">
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void onSearch();
                  }}
                  autoFocus
                  className="h-11 w-full rounded-2xl border border-black/10 bg-transparent px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:border-white/10 dark:text-zinc-100 dark:focus:ring-white/20"
                  placeholder={t("request.searchPlaceholder")}
                />
                <button
                  onClick={() => void onSearch()}
                  disabled={loading}
                  className="h-11 shrink-0 rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {loading ? t("request.searching") : t("request.searchButton")}
                </button>
              </div>
            </div>

            {error ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {t("request.searchError", { error })}
              </p>
            ) : null}
            {cooldownRemaining > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t("request.cooldownHint", { seconds: cooldownRemaining })}
              </p>
            ) : null}
            {lastRequestedTitle && cooldownRemaining > 0 ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                {t("request.lastRequested", { title: lastRequestedTitle })}
              </p>
            ) : null}
          </div>
        </section>

        {!selected && songs.length > 0 ? (
        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t("request.resultsTitle")}
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            {songs.map((s) => (
                <div
                  key={`${s.platform}:${s.platformSongId}`}
                  className="flex items-center gap-3 rounded-2xl border border-black/10 p-3 dark:border-white/10 sm:gap-4 sm:p-4"
                >
                  <SongCover url={s.coverUrl} title={s.title} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {s.title}
                    </div>
                    <div className="truncate text-xs text-zinc-600 dark:text-zinc-300">
                      {s.artist}
                      {s.album ? ` · ${s.album}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelected(s);
                      setSelectedAt(Date.now());
                    }}
                    className="h-9 shrink-0 rounded-full bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  >
                    {t("request.selectButton")}
                  </button>
                </div>
              ))}
          </div>
        </section>
        ) : null}

        {selected ? (
          <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t("request.selectedTitle")}
            </h2>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-black/10 p-3 dark:border-white/10 sm:gap-4 sm:p-4">
              <SongCover url={selected.coverUrl} title={selected.title} size={72} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {selected.title}
                </div>
                <div className="truncate text-xs text-zinc-600 dark:text-zinc-300">
                  {selected.artist}
                  {selected.album ? ` · ${selected.album}` : ""}
                </div>
                {selectedAt ? (
                  <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {t("request.selectedAt", {
                      time: new Date(selectedAt).toLocaleTimeString(),
                    })}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => {
                    setSelected(null);
                    setSelectedAt(null);
                  }}
                  disabled={requesting}
                  className="h-9 rounded-full border border-black/10 px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/10"
                >
                  {t("request.changeSong")}
                </button>
                <button
                  onClick={() => void onRequestSong()}
                  disabled={requesting || cooldownRemaining > 0}
                  className="h-9 rounded-full bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {requesting ? t("request.submitting") : t("request.submit")}
                </button>
              </div>
            </div>
            {requestError ? (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                {t("request.submitError", { error: requestError })}
              </p>
            ) : null}
          </section>
        ) : null}

        <QueueSection
          queued={queued}
          played={played}
          loading={queueLoading}
          filter={queueFilter}
          onFilterChange={setQueueFilter}
          onRefresh={() => void loadQueue()}
        />
      </div>
    </div>
  );
}

function QueueSection({
  queued,
  played,
  loading,
  filter,
  onFilterChange,
  onRefresh,
}: {
  queued: QueueItem[];
  played: QueueItem[];
  loading: boolean;
  filter: QueueFilter;
  onFilterChange: (f: QueueFilter) => void;
  onRefresh: () => void;
}) {
  const t = useT();
  const applyFilter = (items: QueueItem[]) =>
    filter === "all" ? items : items.filter((i) => i.user.role === filter);
  const q = applyFilter(queued);
  const p = applyFilter(played);

  const filterOptions: Array<{ id: QueueFilter; label: string }> = [
    { id: "all", label: t("queue.filterAll") },
    { id: "student", label: t("queue.filterStudent") },
    { id: "teacher", label: t("queue.filterTeacher") },
  ];

  return (
    <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {t("queue.title")}
        </h2>
        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label={t("queue.title")}
            className="inline-flex items-center overflow-hidden rounded-full border border-black/10 bg-white text-xs dark:border-white/15 dark:bg-zinc-950"
          >
            {filterOptions.map((opt) => (
              <button
                key={opt.id}
                role="tab"
                aria-selected={filter === opt.id}
                onClick={() => onFilterChange(opt.id)}
                className={`px-3 py-1.5 ${filter === opt.id ? "bg-zinc-900 text-white dark:bg-white dark:text-black" : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-white/10"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="h-8 rounded-full border border-black/10 px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/10"
          >
            {loading ? t("common.refreshing") : t("common.refresh")}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <QueueColumn
          title={t("queue.queued")}
          empty={t("queue.emptyQueued")}
          items={q}
          accent="bg-emerald-500"
          showIndex
        />
        <QueueColumn
          title={t("queue.played")}
          empty={t("queue.emptyPlayed")}
          items={p}
          accent="bg-zinc-400 dark:bg-zinc-500"
        />
      </div>
    </section>
  );
}

function QueueColumn({
  title,
  empty,
  items,
  accent,
  showIndex,
}: {
  title: string;
  empty: string;
  items: QueueItem[];
  accent: string;
  showIndex?: boolean;
}) {
  const t = useT();
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${accent}`} />
        <h3 className="text-xs font-semibold tracking-wide text-zinc-700 dark:text-zinc-200">
          {title}
          <span className="ml-1 text-zinc-400 dark:text-zinc-500">({items.length})</span>
        </h3>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 p-4 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          {empty}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, idx) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-black/10 p-2.5 dark:border-white/10"
            >
              {showIndex ? (
                <span className="ml-1 w-5 shrink-0 text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {idx + 1}
                </span>
              ) : null}
              <SongCover url={item.song.coverUrl} title={item.song.title} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {item.song.title}
                </div>
                <div className="truncate text-[11px] text-zinc-600 dark:text-zinc-300">
                  {item.song.artist}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    item.user.role === "teacher"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                      : "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200"
                  }`}
                >
                  {item.user.role === "teacher"
                    ? t("queue.roleTeacher")
                    : t("queue.roleStudent")}
                </span>
                <span className="max-w-[8rem] truncate text-[11px] text-zinc-600 dark:text-zinc-300">
                  {item.user.name || t("queue.anonymous")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SongCover({
  url,
  title,
  size,
}: {
  url: string;
  title: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const px = `${size}px`;
  if (!url || failed) {
    return (
      <div
        aria-hidden
        style={{ width: px, height: px }}
        className="shrink-0 rounded-xl bg-gradient-to-br from-zinc-200 to-zinc-100 dark:from-white/10 dark:to-white/5"
      />
    );
  }
  const optimized = url.includes("music.126.net")
    ? `${url}${url.includes("?") ? "&" : "?"}param=${size * 2}y${size * 2}`
    : url;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={optimized}
      alt={title}
      loading="lazy"
      referrerPolicy="no-referrer"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-xl bg-zinc-100 object-cover dark:bg-white/10"
      style={{ width: px, height: px }}
    />
  );
}


