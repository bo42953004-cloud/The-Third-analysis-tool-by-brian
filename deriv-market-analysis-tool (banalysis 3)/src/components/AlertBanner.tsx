"use client";

import { useEffect, useState } from "react";
import type { EngineEvent } from "@/lib/engine";

const STYLE: Record<string, string> = {
  ENTER: "bg-emerald-500 text-white",
  STOP: "bg-amber-500 text-black",
  WARNING: "bg-red-500 text-white",
  SETUP: "bg-slate-700 text-white",
};

/** Floating toast for the most recent high-priority event. */
export function AlertBanner({ events }: { events: EngineEvent[] }) {
  const [current, setCurrent] = useState<EngineEvent | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const latest = events.find(
    (e) => e.kind === "ENTER" || e.kind === "STOP" || e.kind === "WARNING",
  );

  useEffect(() => {
    if (latest && latest.id !== dismissedId) {
      setCurrent(latest);
      const t = setTimeout(() => {
        setCurrent(null);
        setDismissedId(latest.id);
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [latest, dismissedId]);

  if (!current) return null;

  return (
    <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-pulse">
      <div
        className={`flex items-center gap-3 rounded-xl px-5 py-3 shadow-2xl ${
          STYLE[current.kind] ?? STYLE.SETUP
        }`}
      >
        <span className="text-lg font-black">
          {current.kind === "ENTER"
            ? "🟢 ENTER"
            : current.kind === "STOP"
              ? "🛑 STOP"
              : "⚠️ WARNING"}
        </span>
        <div className="text-sm">
          <b>{current.symbolName}</b> · {current.direction}
          <span className="block text-xs opacity-90">{current.message}</span>
        </div>
        <button
          onClick={() => {
            setCurrent(null);
            setDismissedId(current.id);
          }}
          className="ml-2 rounded px-2 text-lg leading-none opacity-70 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
