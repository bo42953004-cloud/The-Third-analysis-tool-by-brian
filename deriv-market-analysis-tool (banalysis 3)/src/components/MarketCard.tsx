"use client";

import { useState } from "react";
import type { MarketView } from "@/lib/engine";
import type { DirectionEvaluation } from "@/lib/analysis";
import { DigitCircles } from "./DigitCircles";
import { DigitStream } from "./DigitStream";

function ConditionList({ evaln }: { evaln: DirectionEvaluation }) {
  return (
    <ul className="space-y-1">
      {evaln.checks.map((c) => (
        <li key={c.label} className="flex items-start gap-2 text-[11px]">
          <span
            className={
              c.passed
                ? "text-emerald-500 dark:text-emerald-400"
                : "text-slate-400 dark:text-slate-600"
            }
          >
            {c.passed ? "✓" : "✗"}
          </span>
          <span
            className={
              c.passed
                ? "text-slate-700 dark:text-slate-200"
                : "text-slate-400 dark:text-slate-500"
            }
          >
            {c.label}
            <span className="block text-[10px] text-slate-400 dark:text-slate-500">
              {c.detail}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MarketCard({ view }: { view: MarketView }) {
  const [tab, setTab] = useState<"EVEN" | "ODD">(
    view.dominant === "ODD" ? "ODD" : "EVEN",
  );
  const evaln = tab === "EVEN" ? view.even : view.odd;

  const setupColor =
    view.activeSetup === "EVEN"
      ? "border-cyan-500 shadow-cyan-500/20"
      : view.activeSetup === "ODD"
        ? "border-orange-500 shadow-orange-500/20"
        : "border-slate-200 dark:border-slate-800";

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-lg dark:bg-slate-900/80 ${setupColor}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {view.symbolName}
          </h3>
          <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
            {view.symbol} · {view.analysisCount} ticks
          </p>
        </div>
        <div className="text-right">
          <DominanceBadge view={view} />
          {view.paused && (
            <span className="mt-1 block rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
              PAUSED · {view.runIndex} runs
            </span>
          )}
        </div>
      </div>

      {/* EVEN vs ODD split percentages */}
      <div className="mb-3 flex overflow-hidden rounded text-[11px] font-bold">
        <div
          className="bg-cyan-500/30 py-1 text-center text-cyan-700 dark:text-cyan-200"
          style={{ width: `${view.frequencies.evenPct}%` }}
        >
          E {view.frequencies.evenPct.toFixed(1)}%
        </div>
        <div
          className="bg-orange-500/30 py-1 text-center text-orange-700 dark:text-orange-200"
          style={{ width: `${view.frequencies.oddPct}%` }}
        >
          O {view.frequencies.oddPct.toFixed(1)}%
        </div>
      </div>

      <DigitCircles ranking={view.ranking} lastDigit={view.lastDigit} />

      <div className="mt-3">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Last {view.digits.length} digits
        </p>
        <DigitStream digits={view.digits} />
      </div>

      {view.primed && (
        <div className="mt-3 rounded bg-purple-500/20 px-2 py-1.5 text-[11px] text-purple-700 dark:text-purple-200">
          🎯 Primed for <b>{view.primed.direction}</b> · {view.primed.ticksLeft}{" "}
          ticks left
          {view.primed.direction === "ODD" &&
            ` · ${view.primed.consecutiveOdd}/2 odd`}
        </div>
      )}

      <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
        <div className="mb-2 flex gap-1">
          {(["EVEN", "ODD"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setTab(d)}
              className={`flex-1 rounded px-2 py-1 text-[11px] font-bold transition ${
                tab === d
                  ? d === "EVEN"
                    ? "bg-cyan-500 text-white"
                    : "bg-orange-500 text-white"
                  : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {d} {(d === "EVEN" ? view.even : view.odd).setupValid ? "✓" : ""}
            </button>
          ))}
        </div>
        <ConditionList evaln={evaln} />
      </div>
    </div>
  );
}

function DominanceBadge({ view }: { view: MarketView }) {
  const color =
    view.dominant === "EVEN"
      ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
      : view.dominant === "ODD"
        ? "bg-orange-500/20 text-orange-700 dark:text-orange-300"
        : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400";
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${color}`}
      title={view.dominantReason}
    >
      {view.dominant === "NONE" ? "—" : `${view.dominant} ▲`}
    </span>
  );
}
