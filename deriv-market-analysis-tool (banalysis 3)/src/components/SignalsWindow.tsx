"use client";

import type { EngineEvent } from "@/lib/engine";

const KIND_STYLE: Record<string, string> = {
  ENTER:
    "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  STOP: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  WARNING: "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300",
  SETUP:
    "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
};

const KIND_ICON: Record<string, string> = {
  ENTER: "🟢",
  STOP: "🛑",
  WARNING: "⚠️",
  SETUP: "🔎",
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function SignalsWindow({ events }: { events: EngineEvent[] }) {
  const entries = events.filter((e) => e.kind === "ENTER");

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Active Signals
        </h2>
        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
          {entries.length} ENTER
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {events.length === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No signals yet. Monitoring markets…
          </p>
        )}
        {events.map((ev) => (
          <div
            key={ev.id}
            className={`rounded-lg border px-3 py-2 text-[11px] ${
              KIND_STYLE[ev.kind] ?? KIND_STYLE.SETUP
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">
                {KIND_ICON[ev.kind]} {ev.kind} · {ev.direction}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {timeAgo(ev.createdAt)}
              </span>
            </div>
            <p className="mt-0.5 text-slate-600 dark:text-slate-300">
              {ev.symbolName}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
              {ev.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
