"use client";

export function DigitStream({ digits }: { digits: number[] }) {
  // newest last; show most recent to the right
  const shown = digits.slice(-30);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((d, i) => {
        const even = d % 2 === 0;
        const isLatest = i === shown.length - 1;
        return (
          <div
            key={i}
            title={even ? "EVEN" : "ODD"}
            className={`flex h-7 w-7 flex-col items-center justify-center rounded text-xs font-bold transition-all ${
              even
                ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
                : "bg-orange-500/20 text-orange-700 dark:text-orange-300"
            } ${
              isLatest
                ? "scale-110 ring-2 ring-slate-900/70 dark:ring-white/70"
                : ""
            }`}
          >
            {d}
          </div>
        );
      })}
      {shown.length === 0 && (
        <span className="text-xs text-slate-400 dark:text-slate-500">
          Waiting for ticks…
        </span>
      )}
    </div>
  );
}
