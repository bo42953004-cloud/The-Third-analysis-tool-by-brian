"use client";

import type { OUSynthesis } from "@/lib/analysis";

export function OverUnderSynthesis({ synth }: { synth: OUSynthesis }) {
  const active = synth.recommendation !== "NONE";
  return (
    <div
      className={`rounded-xl border-2 bg-white p-4 shadow-lg dark:bg-slate-900/80 ${
        active ? "border-emerald-500" : "border-slate-300 dark:border-slate-700"
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Over / Under Signal Synthesis
          </h3>
          <p className="text-[11px] text-slate-500">
            Independent interpretation of both windows
          </p>
        </div>
        <span className="text-lg">🧠</span>
      </div>

      {/* Recommendation banner */}
      <div
        className={`mb-3 rounded-lg px-3 py-3 text-center ${
          active
            ? "bg-emerald-500/15"
            : "bg-slate-100 dark:bg-slate-800/60"
        }`}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Recommendation
        </p>
        <p
          className={`text-base font-black ${
            active
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-500"
          }`}
        >
          {synth.recommendationLabel}
        </p>
        <div className="mx-auto mt-2 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full rounded-full ${
              active ? "bg-emerald-500" : "bg-amber-500"
            }`}
            style={{ width: `${synth.confidence}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] font-bold text-slate-500">
          {synth.confidence}% confidence
        </p>
      </div>

      <p className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        {synth.reason}
      </p>

      {/* Per-signal strength readout */}
      <div className="space-y-2">
        {synth.signals.map((s) => (
          <div
            key={s.key}
            className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    s.active ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  {s.label}
                </span>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-[9px] font-black ${
                  s.active
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                    : "bg-slate-200 text-slate-500 dark:bg-slate-800"
                }`}
              >
                {s.active ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full ${
                    s.active ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${s.strength}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-500">
                {s.metCount}/{s.total} · {s.strength}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
