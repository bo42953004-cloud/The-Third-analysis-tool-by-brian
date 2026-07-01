"use client";

import { COLOR_HEX, type ColorRanking, type ColorName } from "@/lib/analysis";

const COLOR_ORDER: ColorName[] = [
  "GREEN",
  "BLUE",
  "PURPLE",
  "BROWN",
  "YELLOW",
  "RED",
];

/**
 * Digits 0-9 rendered as colored circles with their appearance % inside.
 * A pointer marks the current last digit reported by Deriv.
 */
export function DigitCircles({
  ranking,
  lastDigit,
}: {
  ranking: ColorRanking;
  lastDigit: number | null;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-10 gap-0.5">
        {ranking.bars.map((bar) => {
          const isLast = bar.digit === lastDigit;
          const ringed = bar.color !== "NONE";
          return (
            <div key={bar.digit} className="flex flex-col items-center gap-0.5">
              {/* Pointer above the last digit */}
              <div className="h-2.5">
                {isLast && (
                  <span
                    className="block animate-bounce text-[9px] leading-none"
                    style={{ color: COLOR_HEX[bar.color] }}
                    title="Current last digit"
                  >
                    ▼
                  </span>
                )}
              </div>
              <div
                className={`relative flex aspect-square w-full max-w-8 flex-col items-center justify-center rounded-full border-2 transition-all ${
                  isLast ? "scale-110 shadow-md" : ""
                }`}
                style={{
                  borderColor: ringed ? COLOR_HEX[bar.color] : "#94a3b8",
                  backgroundColor: ringed
                    ? `${COLOR_HEX[bar.color]}26`
                    : "transparent",
                  boxShadow: isLast
                    ? `0 0 0 2px ${COLOR_HEX[bar.color]}55`
                    : undefined,
                }}
              >
                <span
                  className="text-[11px] font-black leading-none"
                  style={{ color: ringed ? COLOR_HEX[bar.color] : undefined }}
                >
                  {bar.digit}
                </span>
                <span className="text-[7px] font-semibold leading-tight text-slate-500 dark:text-slate-400">
                  {bar.pct.toFixed(1)}
                </span>
              </div>
              <span
                className={`text-[8px] font-bold leading-none ${
                  bar.parity === "EVEN"
                    ? "text-cyan-600 dark:text-cyan-300"
                    : "text-orange-600 dark:text-orange-300"
                }`}
              >
                {bar.parity === "EVEN" ? "E" : "O"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Color legend with assigned digit + pct */}
      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
        {COLOR_ORDER.map((c) => {
          const bar = ranking.byColor[c as Exclude<ColorName, "NONE">];
          return (
            <div
              key={c}
              className="flex items-center gap-1.5 rounded bg-slate-200/70 px-2 py-1 dark:bg-slate-800/60"
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: COLOR_HEX[c] }}
              />
              <span className="text-slate-600 dark:text-slate-300">{c}</span>
              {bar ? (
                <span className="ml-auto font-mono text-slate-900 dark:text-slate-100">
                  {bar.digit}
                  <span className="text-slate-400 dark:text-slate-500">·</span>
                  {bar.pct.toFixed(1)}%
                </span>
              ) : (
                <span className="ml-auto text-slate-400 dark:text-slate-600">
                  —
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
