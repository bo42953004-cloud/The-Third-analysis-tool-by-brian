"use client";

import { useMemo, useState } from "react";
import { useDerivMarkets, type ConnectionStatus } from "@/hooks/useDerivMarkets";
import { useTheme } from "@/hooks/useTheme";
import { MarketCard } from "./MarketCard";
import { SignalsWindow } from "./SignalsWindow";
import { AlertBanner } from "./AlertBanner";
import { OverUnderDashboard } from "./OverUnderDashboard";

const STATUS_LABEL: Record<ConnectionStatus, { text: string; cls: string }> = {
  connecting: {
    text: "Connecting…",
    cls: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  },
  connected: {
    text: "Live",
    cls: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  },
  reconnecting: {
    text: "Reconnecting…",
    cls: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  },
  error: { text: "Error", cls: "bg-red-500/20 text-red-700 dark:text-red-300" },
  closed: {
    text: "Disconnected",
    cls: "bg-slate-300/60 text-slate-600 dark:bg-slate-600/40 dark:text-slate-300",
  },
};

type Filter = "ALL" | "SETUP" | "EVEN" | "ODD";

export function Dashboard() {
  const { status, views, events, error, reconnect } = useDerivMarkets();
  const { theme, toggle } = useTheme();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [mode, setMode] = useState<"EVENODD" | "OVERUNDER">("EVENODD");

  const filtered = useMemo(() => {
    switch (filter) {
      case "SETUP":
        return views.filter((v) => v.activeSetup !== "NONE");
      case "EVEN":
        return views.filter((v) => v.dominant === "EVEN");
      case "ODD":
        return views.filter((v) => v.dominant === "ODD");
      default:
        return views;
    }
  }, [views, filter]);

  const setupCount = views.filter((v) => v.activeSetup !== "NONE").length;
  const st = STATUS_LABEL[status];

  const chip =
    "rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AlertBanner events={events} />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-100/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-black tracking-tight">
              Deriv{" "}
              <span className="text-emerald-600 dark:text-emerald-400">
                Digit
              </span>{" "}
              Analyzer
            </h1>
            <p className="text-[11px] text-slate-500">
              EVEN / ODD strategy engine · color-ranked digit frequencies ·
              Volatility + Jump indices
            </p>
          </div>

          <div className="flex overflow-hidden rounded-full border border-slate-300 dark:border-slate-700">
            {(
              [
                ["EVENODD", "EVEN / ODD"],
                ["OVERUNDER", "OVER / UNDER"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-xs font-bold transition ${
                  mode === m
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-transparent text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}
            >
              ● {st.text}
            </span>
            <span className={chip}>{views.length} markets</span>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              {setupCount} active setups
            </span>
            <button
              onClick={toggle}
              className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Toggle light / dark theme"
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
            <button
              onClick={reconnect}
              className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              ↻ Reconnect
            </button>
          </div>
        </div>
        {error && (
          <div className="bg-red-500/10 px-4 py-1 text-center text-[11px] text-red-600 dark:text-red-300">
            {error}
          </div>
        )}
      </header>

      {mode === "OVERUNDER" ? (
        <main className="mx-auto max-w-[1600px] px-4 py-4">
          {views.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-slate-200 bg-white py-24 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="text-center">
                <div className="mb-2 animate-spin text-2xl">◌</div>
                Connecting to Deriv & loading tick history per market…
              </div>
            </div>
          ) : (
            <OverUnderDashboard views={views} />
          )}
        </main>
      ) : (
      <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="mb-3 flex gap-1.5">
            {(["ALL", "SETUP", "EVEN", "ODD"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  filter === f
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {views.length === 0 ? (
            <div className="grid place-items-center rounded-xl border border-slate-200 bg-white py-24 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="text-center">
                <div className="mb-2 animate-spin text-2xl">◌</div>
                Connecting to Deriv & loading tick history per market…
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((v) => (
                <MarketCard key={v.symbol} view={v} />
              ))}
              {filtered.length === 0 && (
                <p className="col-span-full py-12 text-center text-sm text-slate-500">
                  No markets match the “{filter}” filter right now.
                </p>
              )}
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-[68px] lg:h-[calc(100vh-84px)]">
          <div className="h-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/50">
            <SignalsWindow events={events} />
          </div>
        </aside>
      </main>
      )}

      <footer className="mx-auto max-w-[1600px] px-4 pb-8 pt-2 text-[11px] text-slate-400 dark:text-slate-600">
        Educational analysis tool. Synthetic index data via Deriv WebSocket API.
        Signals are statistical observations, not financial advice.
      </footer>
    </div>
  );
}
