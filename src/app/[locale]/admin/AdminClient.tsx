"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/i18n/I18nContext";

type Song = {
  title: string;
  artist: string;
  album: string;
  coverUrl?: string;
};

type RequestItem = {
  id: string;
  status?: string;
  createdAt: string;
  song: Song;
  user?: { id: string; role: string; name?: string | null };
};

export function AdminClient({ locale }: { locale: string }) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState<boolean>(false);

  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queued, setQueued] = useState<RequestItem[]>([]);
  const [played, setPlayed] = useState<RequestItem[]>([]);
  const [clearingPlayed, setClearingPlayed] = useState(false);

  async function login() {
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setIsAuthed(false);
        setLoginError(json.error ?? "login_failed");
        return;
      }
      setIsAuthed(true);
      setPassword("");
      void loadQueue();
    } catch {
      setIsAuthed(false);
      setLoginError("network_error");
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    setIsAuthed(false);
    setQueued([]);
    setPlayed([]);
  }

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    setQueueError(null);
    try {
      const res = await fetch("/api/requests?scope=admin", {
        method: "GET",
        cache: "no-store",
      });
      const json = (await res.json()) as
        | { queued?: RequestItem[]; played?: RequestItem[] }
        | { error: string };
      if (!res.ok) {
        setQueued([]);
        setPlayed([]);
        setQueueError("error" in json ? json.error : "load_failed");
        if ("error" in json && json.error === "access_denied") setIsAuthed(false);
        return;
      }
      if ("queued" in json || "played" in json) {
        setQueued(json.queued ?? []);
        setPlayed(json.played ?? []);
      } else {
        setQueued([]);
        setPlayed([]);
      }
    } catch {
      setQueued([]);
      setPlayed([]);
      setQueueError("network_error");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    void loadQueue();
    const id = window.setInterval(() => {
      void loadQueue();
    }, 10000);
    return () => window.clearInterval(id);
  }, [isAuthed, loadQueue]);

  async function act(id: string, action: "remove" | "play") {
    await fetch(`/api/requests/${id}/${action}`, { method: "POST" }).catch(
      () => undefined,
    );
    await loadQueue();
  }

  async function clearPlayed() {
    if (!isAuthed) return;
    setClearingPlayed(true);
    try {
      await fetch("/api/requests/played/clear", { method: "POST" }).catch(() => undefined);
    } finally {
      setClearingPlayed(false);
      await loadQueue();
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("admin.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            {isAuthed ? t("admin.statusAuthed") : t("admin.statusDenied")}
          </p>
        </div>
        <a
          href={`/${locale}`}
          className="rounded-full border border-black/10 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/10"
        >
          {t("admin.backHome")}
        </a>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {t("admin.loginTitle")}
          </h2>

          {isAuthed ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-sm text-zinc-700 dark:text-zinc-200">
                {t("admin.loggedInHint")}
              </div>
              <button
                onClick={() => void logout()}
                className="h-10 rounded-2xl border border-black/10 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/10"
              >
                {t("admin.logout")}
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 flex gap-2">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void login();
                  }}
                  type="password"
                  className="h-11 w-full rounded-2xl border border-black/10 bg-transparent px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:border-white/10 dark:text-zinc-100 dark:focus:ring-white/20"
                  placeholder={t("admin.passwordPlaceholder")}
                />
                <button
                  onClick={() => void login()}
                  disabled={loggingIn}
                  className="h-11 shrink-0 rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                >
                  {loggingIn ? t("admin.loggingIn") : t("admin.login")}
                </button>
              </div>
              {loginError ? (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {t("admin.loginError", { error: loginError })}
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t("admin.queueTitle")}
            </h2>
            <button
              onClick={() => void loadQueue()}
              disabled={!isAuthed || loadingQueue}
              className="h-9 rounded-full border border-black/10 px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/10"
            >
              {loadingQueue ? t("common.refreshing") : t("common.refresh")}
            </button>
          </div>

          {queueError ? (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {t("admin.queueLoadError", { error: queueError })}
            </p>
          ) : null}

          <div className="mt-4 flex flex-col gap-3">
            {!isAuthed ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                {t("admin.queueLoginRequired")}
              </div>
            ) : queued.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                {t("admin.queueEmptyHint")}
              </div>
            ) : (
              queued.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-black/10 p-3 dark:border-white/10 sm:p-4"
                >
                  <div className="flex items-start gap-3">
                    <QueueCover url={r.song.coverUrl ?? ""} title={r.song.title} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {r.song.title}
                      </div>
                      <div className="truncate text-xs text-zinc-600 dark:text-zinc-300">
                        {r.song.artist}
                        {r.song.album ? ` · ${r.song.album}` : ""}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
                          {r.user?.name ?? t("admin.anonymous")}
                          {r.user?.role
                            ? ` · ${r.user.role === "teacher" ? t("admin.roleTeacher") : t("admin.roleStudent")}`
                            : ""}
                        </span>
                        <span>{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => void act(r.id, "play")}
                        className="h-8 rounded-full bg-zinc-900 px-3 text-[11px] font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                      >
                        {t("admin.markPlayed")}
                      </button>
                      <button
                        onClick={() => void act(r.id, "remove")}
                        className="h-8 rounded-full border border-black/10 px-3 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/10"
                      >
                        {t("admin.remove")}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t("admin.playedTitle")}
            </h2>
            <button
              onClick={() => void clearPlayed()}
              disabled={!isAuthed || clearingPlayed}
              className="h-9 rounded-full border border-black/10 px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/10"
            >
              {clearingPlayed ? t("admin.clearingPlayed") : t("admin.clearPlayed")}
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {!isAuthed ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                {t("admin.queueLoginRequired")}
              </div>
            ) : played.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                {t("queue.emptyPlayed")}
              </div>
            ) : (
              played.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-black/10 p-3 dark:border-white/10 sm:p-4"
                >
                  <div className="flex items-start gap-3">
                    <QueueCover url={r.song.coverUrl ?? ""} title={r.song.title} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {r.song.title}
                      </div>
                      <div className="truncate text-xs text-zinc-600 dark:text-zinc-300">
                        {r.song.artist}
                        {r.song.album ? ` · ${r.song.album}` : ""}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
                          {r.user?.name ?? t("admin.anonymous")}
                          {r.user?.role
                            ? ` · ${r.user.role === "teacher" ? t("admin.roleTeacher") : t("admin.roleStudent")}`
                            : ""}
                        </span>
                        <span>{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => void act(r.id, "remove")}
                        className="h-8 rounded-full border border-black/10 px-3 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/10"
                      >
                        {t("admin.remove")}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function QueueCover({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const size = 48;
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


