"use client";

import type { OUEvaluation, OUStatus } from "@/lib/analysis";
import type { DigitTrend, Frequencies } from "@/lib/analysis";

const STATUS_TEXT: Record<OUStatus, string> = {
  MET: "text-emerald-600 dark:text-emerald-400",
  NOT_MET: "text-red-600 dark:text-red-400",
  MONITOR: "text-amber-600 dark:text-amber-400",
};
const STATUS_DOT: Record<OUStatus, string> = {
  MET: "bg-emerald-500",
  NOT_MET: "bg-red-500",
  MONITOR: "bg-amber-500",
};
const STATUS_LABEL: Record<OUStatus, string> = {
  MET: "MET",
  NOT_MET: "NOT MET",
  MONITOR: "MONITOR",
};

function TrendIcon({ t }: { t: DigitTrend }) {
  if (t.dir === "UP") return <span className="text-emerald-500">▲</span>;
  if (t.dir === "DOWN") return <span className="text-red-500">▼</span>;
  return <span className="text-slate-400">▬</span>;
}

export function OverUnderWindow({
  evaln,
  freq,
  trends,
  highlight,
}: {
  evaln: OUEvaluation;
  freq: Frequencies;
  trends: DigitTrend[];
  /** digits to emphasise in the frequency strip for this window */
  highlight: number[];
}) {
  const maxPct = Math.max(...freq.pct, 1);
  const headerTone = evaln.allMet
    ? "border-emerald-500"
    : evaln.metCount > 0
      ? "border-amber-500"
      : "border-red-500";

  return (
    <div
      className={`rounded-xl border-2 bg-white p-4 shadow-lg dark:bg-slate-900/80 ${headerTone}`}
    >
      {/* Header + summary */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
            {evaln.title}
          </h3>
          <p className="text-[11px] text-slate-500">
            {evaln.ready ? "Live analysis" : "Buffering sample…"}
          </p>
        </div>
        <div className="text-right">
          <div
            className={`rounded-lg px-2 py-1 text-xs font-black ${
              evaln.allMet
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                : evaln.metCount > 0
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                  : "bg-red-500/20 text-red-600 dark:text-red-300"
            }`}
          >
            {evaln.metCount}/{evaln.total} MET
          </div>
          <div className="mt-1 text-[10px] font-bold text-slate-500">
            {evaln.strength}% strength
          </div>
        </div>
      </div>

      {/* Digit frequency strip with per-digit highlight + trend + entry bar */}
      <div className="mb-3 flex items-end gap-1">
        {freq.pct.map((pct, d) => {
          const isEntry = d === evaln.entryDigit;
          const isFocus = highlight.includes(d);
          return (
            <div key={d} className="flex flex-1 flex-col items-center gap-0.5">
              <span className="text-[8px] font-bold text-slate-400">
                {pct.toFixed(1)}
              </span>
              <div className="flex h-16 w-full items-end">
                <div
                  className={`w-full rounded-t transition-all duration-300 ${
                    isEntry
                      ? "bg-emerald-500"
                      : isFocus
                        ? "bg-blue-500/70"
                        : "bg-slate-300 dark:bg-slate-700"
                  }`}
                  style={{ height: `${(pct / maxPct) * 100}%`, minHeight: 3 }}
                />
              </div>
              <div className="text-[9px]">
                <TrendIcon t={trends[d]} />
              </div>
              <span
                className={`text-[11px] font-black ${
                  isEntry
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isFocus
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-slate-500"
                }`}
              >
                {d}
              </span>
            </div>
          );
        })}
      </div>

      {/* Entry signal callout */}
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-black text-white">
          {evaln.entryDigit}
        </span>
        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
          Entry signal — most frequent digit ({freq.pct[evaln.entryDigit].toFixed(1)}%)
        </span>
      </div>

      {/* Condition checklist */}
      <ul className="space-y-1.5">
        {evaln.checks.map((c) => (
          <li
            key={c.label}
            className="flex items-center justify-between rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800/60"
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[c.status]}`}
              />
              <div>
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {c.label}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {c.detail}
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-black ${STATUS_TEXT[c.status]}`}>
              {STATUS_LABEL[c.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
