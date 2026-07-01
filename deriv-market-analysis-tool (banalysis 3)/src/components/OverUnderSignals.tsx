"use client";

export interface OUSignal {
  id: string;
  symbol: string;
  symbolName: string;
  window: "OVER3UNDER4" | "UNDER6OVER5";
  windowLabel: string;
  metCount: number;
  total: number;
  strength: number;
  entryDigit: number;
  createdAt: number;
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function OverUnderSignals({ signals }: { signals: OUSignal[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Active Over/Under Signals
        </h2>
        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
          {signals.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {signals.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No fully-met setups yet. Scanning all markets…
          </p>
        )}
        {signals.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-emerald-500 bg-emerald-500/10 px-3 py-2 text-[11px]"
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-emerald-700 dark:text-emerald-300">
                🟢 {s.windowLabel}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {timeAgo(s.createdAt)}
              </span>
            </div>
            <p className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">
              {s.symbolName}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
              All {s.total} criteria met · {s.strength}% strength · entry digit{" "}
              <b className="text-emerald-600 dark:text-emerald-400">
                {s.entryDigit}
              </b>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
