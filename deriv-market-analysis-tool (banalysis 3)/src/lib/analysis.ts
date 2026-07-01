/**
 * ============================================================================
 * Deriv Market Analysis Engine
 * ============================================================================
 * Pure, framework-agnostic functions that turn a stream of last-digits into
 * frequency distributions, statistical color rankings and EVEN/ODD trade
 * conditions. Everything here is deterministic and unit-testable.
 */

/** Digits shown in the live stream / strategy trigger window. */
export const WINDOW_SIZE = 30;
/**
 * Number of recent ticks used to compute frequency percentages & colors.
 * Deriv's own digit tool aggregates a large sample, so 30 ticks is far too
 * coarse (each digit would jump in ~3.3% steps). We seed and maintain a much
 * larger analysis window for accurate percentages while still driving the
 * entry triggers from the most recent digits.
 */
export const ANALYSIS_WINDOW = 1000;
/** Minimum sample before conditions are trusted. */
export const MIN_SAMPLE = 100;

export type ColorName =
  | "GREEN"
  | "BLUE"
  | "PURPLE"
  | "RED"
  | "YELLOW"
  | "BROWN"
  | "NONE";

export const COLOR_HEX: Record<ColorName, string> = {
  GREEN: "#22c55e",
  BLUE: "#3b82f6",
  PURPLE: "#a855f7",
  RED: "#ef4444",
  YELLOW: "#eab308",
  BROWN: "#a16207",
  NONE: "#475569",
};

export type Direction = "EVEN" | "ODD";

export interface DigitBar {
  digit: number;
  count: number;
  pct: number;
  color: ColorName;
  parity: Direction;
}

export interface Frequencies {
  /** counts indexed by digit 0-9 */
  counts: number[];
  /** percentages indexed by digit 0-9 */
  pct: number[];
  /** total digits considered */
  total: number;
  evenPct: number;
  oddPct: number;
}

export interface ColorRanking {
  bars: DigitBar[]; // length 10, indexed by digit
  byColor: Record<Exclude<ColorName, "NONE">, DigitBar>;
}

export function parityOf(digit: number): Direction {
  return digit % 2 === 0 ? "EVEN" : "ODD";
}

/** Compute counts / percentages for the digits in the rolling window. */
export function computeFrequencies(digits: number[]): Frequencies {
  const counts = new Array(10).fill(0) as number[];
  for (const d of digits) {
    if (d >= 0 && d <= 9) counts[d] += 1;
  }
  const total = digits.length || 1;
  const pct = counts.map((c) => (c / total) * 100);
  let evenPct = 0;
  let oddPct = 0;
  for (let d = 0; d <= 9; d++) {
    if (d % 2 === 0) evenPct += pct[d];
    else oddPct += pct[d];
  }
  return { counts, pct, total: digits.length, evenPct, oddPct };
}

/**
 * Assign the six statistical colors.
 * GREEN  = highest %, BLUE = 2nd, PURPLE = 3rd
 * RED    = lowest %, YELLOW = 2nd lowest, BROWN = 3rd lowest
 * Ties are broken by digit value so the result is deterministic.
 */
export function assignColors(freq: Frequencies): ColorRanking {
  const digits = Array.from({ length: 10 }, (_, d) => d);

  // Highest first (desc). Tie-break: lower digit wins the higher rank.
  const desc = [...digits].sort((a, b) => {
    if (freq.pct[b] !== freq.pct[a]) return freq.pct[b] - freq.pct[a];
    return a - b;
  });
  // Lowest first (asc). Tie-break: lower digit wins the "least" rank.
  const asc = [...digits].sort((a, b) => {
    if (freq.pct[a] !== freq.pct[b]) return freq.pct[a] - freq.pct[b];
    return a - b;
  });

  const colorByDigit = new Array<ColorName>(10).fill("NONE");
  const topColors: ColorName[] = ["GREEN", "BLUE", "PURPLE"];
  const bottomColors: ColorName[] = ["RED", "YELLOW", "BROWN"];

  topColors.forEach((c, i) => {
    colorByDigit[desc[i]] = c;
  });
  bottomColors.forEach((c, i) => {
    // avoid overwriting a top color when fewer than 6 distinct ranks exist
    if (colorByDigit[asc[i]] === "NONE") colorByDigit[asc[i]] = c;
  });

  const bars: DigitBar[] = digits.map((d) => ({
    digit: d,
    count: freq.counts[d],
    pct: freq.pct[d],
    color: colorByDigit[d],
    parity: parityOf(d),
  }));

  const byColor = {} as Record<Exclude<ColorName, "NONE">, DigitBar>;
  for (const bar of bars) {
    if (bar.color !== "NONE") {
      byColor[bar.color] = bar;
    }
  }

  return { bars, byColor };
}

export interface ConditionCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface DirectionEvaluation {
  direction: Direction;
  checks: ConditionCheck[];
  setupValid: boolean;
  dominant: boolean;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Evaluate the EVEN market setup conditions.
 */
export function evaluateEven(
  ranking: ColorRanking,
  freq: Frequencies,
): DirectionEvaluation {
  const { byColor } = ranking;
  const { GREEN, BLUE, PURPLE, RED, YELLOW, BROWN } = byColor;
  const checks: ConditionCheck[] = [];

  const topEven =
    !!BLUE && !!PURPLE && !!GREEN &&
    BLUE.parity === "EVEN" &&
    PURPLE.parity === "EVEN" &&
    GREEN.parity === "EVEN";
  checks.push({
    label: "GREEN/BLUE/PURPLE on EVEN digits",
    passed: topEven,
    detail: `G=${GREEN?.digit}, B=${BLUE?.digit}, P=${PURPLE?.digit}`,
  });

  const topPct = !!BLUE && !!GREEN && GREEN.pct > 10.9 && BLUE.pct > 10.6;
  checks.push({
    label: "GREEN above 10.9% & BLUE above 10.6%",
    passed: topPct,
    detail: `G=${round(GREEN?.pct ?? 0)}%, B=${round(BLUE?.pct ?? 0)}%`,
  });

  const bottomOddOrMix =
    !!RED && !!BROWN && !!YELLOW &&
    (RED.parity === "ODD" || BROWN.parity === "ODD" || YELLOW.parity === "ODD");
  checks.push({
    label: "RED/BROWN/YELLOW on ODD (or mixed)",
    passed: bottomOddOrMix,
    detail: `R=${RED?.digit}, Y=${YELLOW?.digit}, Br=${BROWN?.digit}`,
  });

  const redOk = !!RED && RED.pct <= 9;
  checks.push({
    label: "RED at or below 9%",
    passed: redOk,
    detail: `R=${round(RED?.pct ?? 0)}%`,
  });

  const yellowOk = !!YELLOW && YELLOW.pct <= 9.5;
  checks.push({
    label: "YELLOW at or below 9.5%",
    passed: yellowOk,
    detail: `Y=${round(YELLOW?.pct ?? 0)}%`,
  });

  // Dominance: even side must lead; if any odd digit is higher it must be
  // low activity (<= 10.3%).
  const maxOdd = Math.max(freq.pct[1], freq.pct[3], freq.pct[5], freq.pct[7], freq.pct[9]);
  const dominant = freq.evenPct > freq.oddPct && maxOdd <= 10.3;
  checks.push({
    label: "EVEN statistically dominant",
    passed: dominant,
    detail: `even=${round(freq.evenPct)}% > odd=${round(freq.oddPct)}%, maxOdd=${round(maxOdd)}%`,
  });

  const setupValid = topEven && topPct && bottomOddOrMix && redOk && yellowOk;
  return { direction: "EVEN", checks, setupValid, dominant };
}

/**
 * Evaluate the ODD market setup conditions.
 */
export function evaluateOdd(
  ranking: ColorRanking,
  freq: Frequencies,
): DirectionEvaluation {
  const { byColor } = ranking;
  const { GREEN, BLUE, PURPLE, RED, YELLOW, BROWN } = byColor;
  const checks: ConditionCheck[] = [];

  const topOdd =
    !!GREEN && !!PURPLE && !!BLUE &&
    GREEN.parity === "ODD" &&
    PURPLE.parity === "ODD" &&
    BLUE.parity === "ODD";
  const topPct = !!GREEN && !!PURPLE && !!BLUE &&
    GREEN.pct > 10.9 && PURPLE.pct >= 11 && BLUE.pct > 10.6;
  checks.push({
    label: "GREEN/PURPLE/BLUE on ODD digits",
    passed: topOdd,
    detail: `G=${GREEN?.digit}, P=${PURPLE?.digit}, B=${BLUE?.digit}`,
  });
  checks.push({
    label: "GREEN >10.9%, BLUE >10.6%, PURPLE 11%+",
    passed: topPct,
    detail: `G=${round(GREEN?.pct ?? 0)}%, P=${round(PURPLE?.pct ?? 0)}%, B=${round(BLUE?.pct ?? 0)}%`,
  });

  const bottomEven =
    !!RED && !!BROWN && !!YELLOW &&
    RED.parity === "EVEN" &&
    BROWN.parity === "EVEN" &&
    YELLOW.parity === "EVEN";
  checks.push({
    label: "RED/BROWN/YELLOW on EVEN digits",
    passed: bottomEven,
    detail: `R=${RED?.digit}, Y=${YELLOW?.digit}, Br=${BROWN?.digit}`,
  });

  const redOk = !!RED && RED.pct <= 9;
  checks.push({
    label: "RED at or below 9%",
    passed: redOk,
    detail: `R=${round(RED?.pct ?? 0)}%`,
  });

  const yellowOk = !!YELLOW && YELLOW.pct <= 9.5;
  checks.push({
    label: "YELLOW at or below 9.5%",
    passed: yellowOk,
    detail: `Y=${round(YELLOW?.pct ?? 0)}%`,
  });

  const maxEven = Math.max(freq.pct[0], freq.pct[2], freq.pct[4], freq.pct[6], freq.pct[8]);
  const dominant = freq.oddPct > freq.evenPct && maxEven <= 10.3;
  checks.push({
    label: "ODD statistically dominant",
    passed: dominant,
    detail: `odd=${round(freq.oddPct)}% > even=${round(freq.evenPct)}%, maxEven=${round(maxEven)}%`,
  });

  const setupValid = topOdd && topPct && bottomEven && redOk && yellowOk;
  return { direction: "ODD", checks, setupValid, dominant };
}

/**
 * Count how many of the setup checks are passing — used to power the
 * "about to break" warning system (setup valid but dominance slipping, or
 * only one check away from breaking).
 */
export function warningLevel(evaln: DirectionEvaluation): {
  aboutToBreak: boolean;
  failing: string[];
} {
  const failing = evaln.checks.filter((c) => !c.passed).map((c) => c.label);
  // aboutToBreak = setup currently valid but a single margin condition is fragile
  const aboutToBreak = evaln.setupValid && !evaln.dominant;
  return { aboutToBreak, failing };
}

/* ==========================================================================
 * OVER / UNDER analysis
 * ========================================================================== */

/** Minimum required threshold for the "above 10.4%" digit conditions. */
export const OU_HIGH = 10.4;
/** Maximum threshold for the "below 9.5%" digit conditions. */
export const OU_LOW = 9.5;
/** Delta (percentage points) required to call a trend "increasing". */
export const TREND_EPS = 0.3;

export type TrendDir = "UP" | "DOWN" | "FLAT";

export interface DigitTrend {
  digit: number;
  delta: number; // recent% - older%
  dir: TrendDir;
}

/**
 * Compute a per-digit trend by comparing the most recent half of the sample
 * against the older half. A positive delta above TREND_EPS = increasing.
 */
export function computeTrends(digits: number[]): DigitTrend[] {
  const sample = digits.slice(-Math.min(digits.length, 400));
  const half = Math.floor(sample.length / 2);
  const older = sample.slice(0, half);
  const recent = sample.slice(half);

  const pctOf = (arr: number[], d: number) =>
    arr.length ? (arr.filter((x) => x === d).length / arr.length) * 100 : 0;

  return Array.from({ length: 10 }, (_, d) => {
    const delta = pctOf(recent, d) - pctOf(older, d);
    const dir: TrendDir =
      delta > TREND_EPS ? "UP" : delta < -TREND_EPS ? "DOWN" : "FLAT";
    return { digit: d, delta, dir };
  });
}

export type OUStatus = "MET" | "NOT_MET" | "MONITOR";

export interface OUCheck {
  label: string;
  digits: number[]; // digits this check refers to (for highlighting)
  status: OUStatus;
  detail: string;
}

export type OUKey = "OVER3UNDER4" | "UNDER6OVER5";

export interface OUEvaluation {
  key: OUKey;
  title: string;
  checks: OUCheck[];
  metCount: number;
  total: number;
  allMet: boolean;
  entryDigit: number; // most frequently appearing digit overall
  strength: number; // 0-100 confidence
  ready: boolean; // enough sample to trust
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function argMaxDigit(pct: number[]): number {
  let best = 0;
  for (let d = 1; d <= 9; d++) if (pct[d] > pct[best]) best = d;
  return best;
}

/** Status helper: a value comfortably meeting / near / failing a floor. */
function floorStatus(value: number, floor: number): OUStatus {
  if (value > floor) return "MET";
  if (value >= floor - 0.6) return "MONITOR";
  return "NOT_MET";
}

/** Status helper: a value comfortably under / near / failing a ceiling. */
function ceilStatus(value: number, ceil: number): OUStatus {
  if (value < ceil) return "MET";
  if (value <= ceil + 0.6) return "MONITOR";
  return "NOT_MET";
}

/**
 * WINDOW 1 — REAL OVER 3 UNDER 4 PRO
 * - Digits 0 & 4 above 10.4%
 * - Digit 3 below 9.5%
 * - Digit 1 or 2 above 10.4% AND increasing trend (trend flagged separately)
 */
export function evaluateOver3Under4(
  freq: Frequencies,
  trends: DigitTrend[],
): OUEvaluation {
  const p = freq.pct;
  const checks: OUCheck[] = [];

  checks.push({
    label: "Digit 0 above 10.4%",
    digits: [0],
    status: floorStatus(p[0], OU_HIGH),
    detail: `0 = ${r2(p[0])}%`,
  });
  checks.push({
    label: "Digit 4 above 10.4%",
    digits: [4],
    status: floorStatus(p[4], OU_HIGH),
    detail: `4 = ${r2(p[4])}%`,
  });
  checks.push({
    label: "Digit 3 below 9.5%",
    digits: [3],
    status: ceilStatus(p[3], OU_LOW),
    detail: `3 = ${r2(p[3])}%`,
  });

  // Digit 1 or 2 above 10.4% AND that same digit showing an increasing trend.
  // This is a single criterion so the window mirrors "Under 6 · Over 5" (4 total).
  const t1 = trends[1];
  const t2 = trends[2];
  const oneHighAndUp =
    (p[1] > OU_HIGH && t1.dir === "UP") || (p[2] > OU_HIGH && t2.dir === "UP");
  const oneHigh = p[1] > OU_HIGH || p[2] > OU_HIGH;
  checks.push({
    label: "Digit 1 or 2 above 10.4% & increasing",
    digits: [1, 2],
    status: oneHighAndUp ? "MET" : oneHigh ? "MONITOR" : "NOT_MET",
    detail: `1 = ${r2(p[1])}% (Δ${r2(t1.delta)}), 2 = ${r2(p[2])}% (Δ${r2(t2.delta)})`,
  });

  return finalizeOU("OVER3UNDER4", "Real Over 3 · Under 4 Pro", checks, freq);
}

/**
 * WINDOW 2 — REAL UNDER 6 OVER 5 PRO
 * - Digits 5 & 9 above 10.4%
 * - Digit 6 below 9.5%
 * - Digit 7 or 8 above 10.4%
 */
export function evaluateUnder6Over5(freq: Frequencies): OUEvaluation {
  const p = freq.pct;
  const checks: OUCheck[] = [];

  checks.push({
    label: "Digit 5 above 10.4%",
    digits: [5],
    status: floorStatus(p[5], OU_HIGH),
    detail: `5 = ${r2(p[5])}%`,
  });
  checks.push({
    label: "Digit 9 above 10.4%",
    digits: [9],
    status: floorStatus(p[9], OU_HIGH),
    detail: `9 = ${r2(p[9])}%`,
  });
  checks.push({
    label: "Digit 6 below 9.5%",
    digits: [6],
    status: ceilStatus(p[6], OU_LOW),
    detail: `6 = ${r2(p[6])}%`,
  });

  const oneHigh = p[7] > OU_HIGH || p[8] > OU_HIGH;
  checks.push({
    label: "Digit 7 or 8 above 10.4%",
    digits: [7, 8],
    status: oneHigh
      ? "MET"
      : p[7] >= OU_HIGH - 0.6 || p[8] >= OU_HIGH - 0.6
        ? "MONITOR"
        : "NOT_MET",
    detail: `7 = ${r2(p[7])}%, 8 = ${r2(p[8])}%`,
  });

  return finalizeOU("UNDER6OVER5", "Real Under 6 · Over 5 Pro", checks, freq);
}

function finalizeOU(
  key: OUKey,
  title: string,
  checks: OUCheck[],
  freq: Frequencies,
): OUEvaluation {
  const metCount = checks.filter((c) => c.status === "MET").length;
  const monitor = checks.filter((c) => c.status === "MONITOR").length;
  const total = checks.length;
  const allMet = metCount === total;
  // Strength: full weight for MET, half for MONITOR.
  const strength = Math.round(((metCount + monitor * 0.5) / total) * 100);
  return {
    key,
    title,
    checks,
    metCount,
    total,
    allMet,
    entryDigit: argMaxDigit(freq.pct),
    strength,
    ready: freq.total >= MIN_SAMPLE,
  };
}

export interface OUSynthesis {
  recommendation: OUKey | "NONE";
  recommendationLabel: string;
  confidence: number; // 0-100
  reason: string;
  signals: Array<{
    key: OUKey;
    label: string;
    active: boolean;
    strength: number;
    metCount: number;
    total: number;
  }>;
}

/**
 * WINDOW 3 — independent synthesis.
 * Interprets the readiness/strength of both windows WITHOUT re-reading the raw
 * digit frequencies, then issues a single recommendation.
 */
export function synthesizeOverUnder(
  w1: OUEvaluation,
  w2: OUEvaluation,
): OUSynthesis {
  const signals = [w1, w2].map((w) => ({
    key: w.key,
    label: w.title,
    active: w.allMet && w.ready,
    strength: w.strength,
    metCount: w.metCount,
    total: w.total,
  }));

  let recommendation: OUKey | "NONE" = "NONE";
  let recommendationLabel = "No dominant setup";
  let confidence = 0;
  let reason = "Neither window has all criteria met — keep monitoring.";

  const both = signals.filter((s) => s.active);
  if (both.length === 1) {
    const s = both[0];
    recommendation = s.key;
    recommendationLabel = s.label;
    confidence = s.strength;
    reason = `${s.label} has all ${s.total} criteria met (${s.strength}% strength).`;
  } else if (both.length === 2) {
    // Both fully met: pick the stronger, note the conflict.
    const winner = w1.strength >= w2.strength ? signals[0] : signals[1];
    recommendation = winner.key;
    recommendationLabel = winner.label;
    confidence = Math.round(winner.strength * 0.85); // discounted for conflict
    reason = `Both windows active — favouring ${winner.label} (${winner.strength}%). Treat with caution.`;
  } else {
    // None fully met: surface the closest one as a watch.
    const lead = w1.strength >= w2.strength ? signals[0] : signals[1];
    confidence = lead.strength;
    reason = `Closest: ${lead.label} at ${lead.metCount}/${lead.total} criteria (${lead.strength}%). Not yet confirmed.`;
  }

  return { recommendation, recommendationLabel, confidence, reason, signals };
}
