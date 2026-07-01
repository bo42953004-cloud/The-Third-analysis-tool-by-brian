"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  evaluateOver3Under4,
  evaluateUnder6Over5,
  synthesizeOverUnder,
  type OUEvaluation,
  type OUSynthesis,
} from "@/lib/analysis";
import type { MarketView } from "@/lib/engine";
import { OverUnderWindow } from "./OverUnderWindow";
import { OverUnderSynthesis } from "./OverUnderSynthesis";
import { OverUnderMarketCard } from "./OverUnderMarketCard";
import { OverUnderSignals, type OUSignal } from "./OverUnderSignals";

interface ScanRow {
  view: MarketView;
  w1: OUEvaluation;
  w2: OUEvaluation;
  synth: OUSynthesis;
}

type ScanFilter = "ALL" | "SIGNALS" | "O3U4" | "U6O5";

interface ExpiredEntry {
  key: string; // `${symbol}|${window}`
  symbol: string;
  window: "OVER3UNDER4" | "UNDER6OVER5";
  windowLabel: string;
  at: number; // when it broke
}

const WINDOW_LABEL: Record<"OVER3UNDER4" | "UNDER6OVER5", string> = {
  OVER3UNDER4: "Real Over 3 · Under 4 Pro",
  UNDER6OVER5: "Real Under 6 · Over 5 Pro",
};

const MAX_SIGNALS = 100;
// How long a broken (expired) market stays visible as a red card.
const EXPIRY_TTL = 30000;
let ouCounter = 0;

export function OverUnderDashboard({ views }: { views: MarketView[] }) {
  const [detail, setDetail] = useState<string | null>(null);
  // Strict by default: only markets that fully satisfy a strategy are shown.
  const [filter, setFilter] = useState<ScanFilter>("SIGNALS");
  const [signals, setSignals] = useState<OUSignal[]>([]);
  // recently-broken setups, kept visible as red cards for EXPIRY_TTL.
  const [expired, setExpired] = useState<Record<string, ExpiredEntry>>({});
  // remember which (symbol|window) setups were already active so we only emit
  // a signal on the rising edge (not-active -> active).
  const activeRef = useRef<Set<string>>(new Set());

  // Evaluate every market on each render of the (throttled) views.
  const scan: ScanRow[] = useMemo(() => {
    return views.map((view) => {
      const w1 = evaluateOver3Under4(view.frequencies, view.trends);
      const w2 = evaluateUnder6Over5(view.frequencies);
      const synth = synthesizeOverUnder(w1, w2);
      return { view, w1, w2, synth };
    });
  }, [views]);

  // Detect rising-edge signals (new) and falling-edge (expired) across markets.
  useEffect(() => {
    const nowActive = new Set<string>();
    const fresh: OUSignal[] = [];
    for (const row of scan) {
      for (const w of [row.w1, row.w2]) {
        if (w.allMet && w.ready) {
          const key = `${row.view.symbol}|${w.key}`;
          nowActive.add(key);
          if (!activeRef.current.has(key)) {
            ouCounter += 1;
            fresh.push({
              id: `${Date.now()}-${ouCounter}`,
              symbol: row.view.symbol,
              symbolName: row.view.symbolName,
              window: w.key,
              windowLabel: w.title,
              metCount: w.metCount,
              total: w.total,
              strength: w.strength,
              entryDigit: w.entryDigit,
              createdAt: Date.now(),
            });
          }
        }
      }
    }

    // Falling edges: was active last tick, no longer active now -> broken.
    const now = Date.now();
    const justBroken: ExpiredEntry[] = [];
    activeRef.current.forEach((key) => {
      if (!nowActive.has(key)) {
        const [symbol, window] = key.split("|") as [
          string,
          "OVER3UNDER4" | "UNDER6OVER5",
        ];
        justBroken.push({
          key,
          symbol,
          window,
          windowLabel: WINDOW_LABEL[window],
          at: now,
        });
      }
    });

    activeRef.current = nowActive;

    if (fresh.length) {
      setSignals((prev) => [...fresh, ...prev].slice(0, MAX_SIGNALS));
    }

    setExpired((prev) => {
      const next = { ...prev };
      // clear entries that are active again
      nowActive.forEach((key) => {
        delete next[key];
      });
      // record newly broken setups
      for (const e of justBroken) next[e.key] = e;
      // prune entries older than the TTL
      const cutoff = now - EXPIRY_TTL;
      for (const k of Object.keys(next)) {
        if (next[k].at < cutoff) delete next[k];
      }
      return next;
    });
  }, [scan]);

  const signalCount = scan.filter(
    (r) => r.w1.allMet || r.w2.allMet,
  ).length;
  const brokenCount = Object.keys(expired).length;

  // Combined display: active signal cards first, then recently-broken red cards.
  const display = useMemo(() => {
    const rowBySymbol = new Map(scan.map((r) => [r.view.symbol, r]));
    const wantWindow =
      filter === "O3U4"
        ? "OVER3UNDER4"
        : filter === "U6O5"
          ? "UNDER6OVER5"
          : null;

    const items: { row: ScanRow; expired: ExpiredEntry | null }[] = [];

    if (filter === "ALL") {
      for (const row of scan) {
        const notActive = !row.w1.allMet && !row.w2.allMet;
        const exp =
          notActive
            ? expired[`${row.view.symbol}|OVER3UNDER4`] ??
              expired[`${row.view.symbol}|UNDER6OVER5`] ??
              null
            : null;
        items.push({ row, expired: exp });
      }
      return items;
    }

    // Signal-oriented filters: active cards first.
    const seen = new Set<string>();
    for (const row of scan) {
      const active = wantWindow
        ? wantWindow === "OVER3UNDER4"
          ? row.w1.allMet
          : row.w2.allMet
        : row.w1.allMet || row.w2.allMet;
      if (active) {
        items.push({ row, expired: null });
        seen.add(row.view.symbol);
      }
    }
    // Then the recently-broken red cards.
    for (const e of Object.values(expired)) {
      if (wantWindow && e.window !== wantWindow) continue;
      if (seen.has(e.symbol)) continue; // still active in another window
      const row = rowBySymbol.get(e.symbol);
      if (row) items.push({ row, expired: e });
    }
    return items;
  }, [scan, filter, expired]);

  const detailRow = useMemo(
    () => scan.find((r) => r.view.symbol === detail) ?? null,
    [scan, detail],
  );

  if (views.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-slate-200 bg-white py-24 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="text-center">
          <div className="mb-2 animate-spin text-2xl">◌</div>
          Connecting to Deriv & loading tick history per market…
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <section>
        {/* Scan summary + filters */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Scanning {scan.length} markets
          </span>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            {signalCount} live signals
          </span>
          {brokenCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-300">
              {brokenCount} broken
            </span>
          )}
          <div className="ml-auto flex gap-1.5">
            {(
              [
                ["ALL", "All"],
                ["SIGNALS", "Signals"],
                ["O3U4", "O3·U4"],
                ["U6O5", "U6·O5"],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  filter === f
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {display.map(({ row: r, expired: exp }) => (
            <OverUnderMarketCard
              key={r.view.symbol}
              symbol={r.view.symbol}
              symbolName={r.view.symbolName}
              lastDigit={r.view.lastDigit}
              analysisCount={r.view.analysisCount}
              freq={r.view.frequencies}
              w1={r.w1}
              w2={r.w2}
              synth={r.synth}
              expiredInfo={
                exp ? { windowLabel: exp.windowLabel, at: exp.at } : null
              }
              onOpen={() => setDetail(r.view.symbol)}
            />
          ))}
          {display.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-slate-500">
              {filter === "ALL"
                ? "No markets available yet."
                : "No markets currently meet the full strategy criteria — scanning… (switch to “All” to view every market)."}
            </p>
          )}
        </div>
      </section>

      <aside className="lg:sticky lg:top-[68px] lg:h-[calc(100vh-84px)]">
        <div className="h-full rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/50">
          <OverUnderSignals signals={signals} />
        </div>
      </aside>

      {/* Detail modal — full 3-window analysis for one market */}
      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="my-8 w-full max-w-6xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">
                {detailRow.view.symbolName}
                <span className="ml-2 font-mono text-xs text-slate-400">
                  {detailRow.view.symbol} · last digit{" "}
                  {detailRow.view.lastDigit ?? "—"}
                </span>
              </h2>
              <button
                onClick={() => setDetail(null)}
                className="rounded-full bg-slate-800 px-4 py-1.5 text-sm font-bold text-white hover:bg-slate-700"
              >
                ✕ Close
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <OverUnderWindow
                evaln={detailRow.w1}
                freq={detailRow.view.frequencies}
                trends={detailRow.view.trends}
                highlight={[0, 1, 2, 4]}
              />
              <OverUnderWindow
                evaln={detailRow.w2}
                freq={detailRow.view.frequencies}
                trends={detailRow.view.trends}
                highlight={[5, 7, 8, 9]}
              />
              <OverUnderSynthesis synth={detailRow.synth} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
