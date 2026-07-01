"use client";

import type { OUEvaluation, OUSynthesis, Frequencies } from "@/lib/analysis";

function WindowBadge({ evaln }: { evaln: OUEvaluation }) {
  const tone = evaln.allMet
    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500"
    : evaln.metCount > 0
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/60"
      : "bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/40";
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${tone}`}>
      <p className="text-[10px] font-black uppercase leading-tight">
        {evaln.key === "OVER3UNDER4" ? "O3 · U4" : "U6 · O5"}
      </p>
      <p className="text-[11px] font-black">
        {evaln.metCount}/{evaln.total}
      </p>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={`h-full rounded-full ${
            evaln.allMet ? "bg-emerald-500" : "bg-amber-500"
          }`}
          style={{ width: `${evaln.strength}%` }}
        />
      </div>
    </div>
  );
}

export function OverUnderMarketCard({
  symbol,
  symbolName,
  lastDigit,
  analysisCount,
  freq,
  w1,
  w2,
  synth,
  expiredInfo,
  onOpen,
}: {
  symbol: string;
  symbolName: string;
  lastDigit: number | null;
  analysisCount: number;
  freq: Frequencies;
  w1: OUEvaluation;
  w2: OUEvaluation;
  synth: OUSynthesis;
  expiredInfo?: { windowLabel: string; at: number } | null;
  onOpen: () => void;
}) {
  const anyActive = w1.allMet || w2.allMet;
  const isBroken = !anyActive && !!expiredInfo;
  const border = anyActive
    ? "border-emerald-500 shadow-emerald-500/20"
    : isBroken
      ? "border-red-500 shadow-red-500/20"
      : "border-slate-200 dark:border-slate-800";
  const maxPct = Math.max(...freq.pct, 1);
  const brokeSecs = expiredInfo
    ? Math.max(0, Math.floor((Date.now() - expiredInfo.at) / 1000))
    : 0;

  return (
    <button
      onClick={onOpen}
      className={`w-full rounded-xl border-2 bg-white p-3 text-left shadow-md transition hover:scale-[1.01] dark:bg-slate-900/80 ${border}`}
    >
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h3 className="text-[13px] font-bold leading-tight text-slate-900 dark:text-white">
            {symbolName}
          </h3>
          <p className="font-mono text-[9px] text-slate-400 dark:text-slate-500">
            {symbol} · {analysisCount} ticks
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            last{" "}
            <b className="text-slate-900 dark:text-white">{lastDigit ?? "—"}</b>
          </span>
          {anyActive && (
            <span className="animate-pulse rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black text-white">
              SIGNAL
            </span>
          )}
          {isBroken && (
            <span className="rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
              EXPIRED
            </span>
          )}
        </div>
      </div>

      {isBroken && (
        <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-500/15 px-2 py-1.5 text-[10px] font-bold text-red-700 dark:text-red-300">
          <span>⚠️ CONDITIONS BROKEN</span>
          <span className="ml-auto font-normal text-red-500 dark:text-red-400">
            {expiredInfo?.windowLabel} · {brokeSecs}s ago
          </span>
        </div>
      )}

      {/* mini frequency strip with entry digit highlighted */}
      <div className="mb-2 flex items-end gap-0.5">
        {freq.pct.map((pct, d) => {
          const entry = d === w1.entryDigit;
          return (
            <div key={d} className="flex flex-1 flex-col items-center">
              <div className="flex h-8 w-full items-end">
                <div
                  className={`w-full rounded-t ${
                    entry
                      ? "bg-emerald-500"
                      : "bg-slate-300 dark:bg-slate-700"
                  }`}
                  style={{ height: `${(pct / maxPct) * 100}%`, minHeight: 2 }}
                />
              </div>
              <span
                className={`text-[8px] font-bold ${
                  entry
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400"
                }`}
              >
                {d}
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <WindowBadge evaln={w1} />
        <WindowBadge evaln={w2} />
      </div>

      {/* synthesis line */}
      <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800/60">
        <span className="text-[10px] font-bold text-slate-500">
          {synth.recommendation === "NONE"
            ? "No dominant setup"
            : synth.recommendationLabel}
        </span>
        <span
          className={`text-[10px] font-black ${
            synth.recommendation === "NONE"
              ? "text-slate-400"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {synth.confidence}%
        </span>
      </div>
    </button>
  );
}
