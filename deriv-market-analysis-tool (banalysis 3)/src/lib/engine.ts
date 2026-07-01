/**
 * ============================================================================
 * Market Signal Engine
 * ============================================================================
 * Stateful per-market processor. Feed it the last digits as they arrive and it
 * produces ENTER / WARNING / STOP / SETUP events using the pure analysis
 * functions. It also runs the entry trigger state machines described in the
 * EVEN and ODD strategies and tracks consecutive profitable runs.
 *
 * Percentages / colors are computed over a large rolling analysis window
 * (ANALYSIS_WINDOW) for accuracy, while the entry triggers and the on-screen
 * digit stream use only the most recent digits.
 */

import {
  ANALYSIS_WINDOW,
  MIN_SAMPLE,
  WINDOW_SIZE,
  assignColors,
  computeFrequencies,
  computeTrends,
  evaluateEven,
  evaluateOdd,
  warningLevel,
  type ColorRanking,
  type Direction,
  type DirectionEvaluation,
  type DigitTrend,
  type Frequencies,
} from "./analysis";

export type EventKind = "ENTER" | "WARNING" | "STOP" | "SETUP";

export interface EngineEvent {
  id: string;
  symbol: string;
  symbolName: string;
  kind: EventKind;
  direction: Direction;
  message: string;
  triggerDigit: number | null;
  runIndex: number;
  frequencies: number[];
  createdAt: number;
}

export interface MarketView {
  symbol: string;
  symbolName: string;
  digits: number[]; // last WINDOW_SIZE digits for the live stream (oldest -> newest)
  lastDigit: number | null; // most recent digit reported by Deriv
  analysisCount: number; // how many ticks the percentages are based on
  frequencies: Frequencies;
  trends: DigitTrend[];
  ranking: ColorRanking;
  even: DirectionEvaluation;
  odd: DirectionEvaluation;
  dominant: Direction | "NONE";
  dominantReason: string;
  activeSetup: Direction | "NONE";
  primed: PrimedState | null;
  runIndex: number;
  paused: boolean;
  lastUpdate: number;
}

interface PrimedState {
  direction: Direction;
  ticksLeft: number;
  consecutiveOdd: number; // for ODD strategy
}

// Consecutive profitable runs before forcing a pause (spec: 5-7).
const STOP_THRESHOLD = 6;

interface InternalState {
  symbol: string;
  symbolName: string;
  digits: number[]; // rolling analysis buffer (up to ANALYSIS_WINDOW)
  primed: PrimedState | null;
  runIndex: number;
  paused: boolean;
  lastSetup: Direction | "NONE";
  lastUpdate: number;
  lastWarnAt: number;
}

let eventCounter = 0;
function nextId() {
  eventCounter += 1;
  return `${Date.now()}-${eventCounter}`;
}

export class MarketEngine {
  private states = new Map<string, InternalState>();

  register(symbol: string, symbolName: string) {
    if (!this.states.has(symbol)) {
      this.states.set(symbol, {
        symbol,
        symbolName,
        digits: [],
        primed: null,
        runIndex: 0,
        paused: false,
        lastSetup: "NONE",
        lastUpdate: 0,
        lastWarnAt: 0,
      });
    }
  }

  /** Bulk-load historical digits (from Deriv ticks_history) for accuracy. */
  seedHistory(symbol: string, digits: number[]) {
    const st = this.states.get(symbol);
    if (!st) return;
    const trimmed = digits.slice(-ANALYSIS_WINDOW);
    st.digits = trimmed;
    st.lastUpdate = Date.now();
  }

  /** Process a single new digit for a symbol, returning any events emitted. */
  processDigit(symbol: string, digit: number): EngineEvent[] {
    const st = this.states.get(symbol);
    if (!st) return [];
    const events: EngineEvent[] = [];

    st.digits.push(digit);
    if (st.digits.length > ANALYSIS_WINDOW) st.digits.shift();
    st.lastUpdate = Date.now();

    // Not enough data to evaluate meaningfully.
    if (st.digits.length < MIN_SAMPLE) return events;

    const freq = computeFrequencies(st.digits);
    const ranking = assignColors(freq);
    const even = evaluateEven(ranking, freq);
    const odd = evaluateOdd(ranking, freq);

    const activeEval = even.setupValid && even.dominant
      ? even
      : odd.setupValid && odd.dominant
        ? odd
        : null;
    const activeSetup = activeEval?.direction ?? "NONE";

    // Re-confirmation: resume from pause once the setup drops and returns.
    if (st.paused && activeSetup === "NONE") {
      st.paused = false;
      st.runIndex = 0;
      st.primed = null;
    }

    // Emit a SETUP event when a new valid setup appears.
    if (activeSetup !== "NONE" && st.lastSetup !== activeSetup && !st.paused) {
      events.push(
        this.mk(st, "SETUP", activeSetup, null,
          `Setup formed for ${activeSetup} market — awaiting trigger.`, freq),
      );
    }
    st.lastSetup = activeSetup;

    // Warning: setup valid but dominance slipping (about to break).
    for (const ev of [even, odd]) {
      const wl = warningLevel(ev);
      if (wl.aboutToBreak && Date.now() - st.lastWarnAt > 4000) {
        st.lastWarnAt = Date.now();
        events.push(
          this.mk(st, "WARNING", ev.direction, null,
            `${ev.direction} conditions weakening — dominance not confirmed.`, freq),
        );
      }
    }

    if (st.paused || activeSetup === "NONE" || !activeEval) {
      // Setup no longer valid: drop any pending prime.
      st.primed = null;
      return events;
    }

    // ---- Entry trigger state machines --------------------------------------
    const red = ranking.byColor.RED;
    const yellow = ranking.byColor.YELLOW;
    const isLeastPair = (d: number) => d === red?.digit || d === yellow?.digit;

    if (activeSetup === "EVEN") {
      // Prime when the least-appearing pair (RED/YELLOW) shows an ODD digit.
      if (!st.primed && isLeastPair(digit) && digit % 2 === 1) {
        st.primed = { direction: "EVEN", ticksLeft: 3, consecutiveOdd: 0 };
      } else if (st.primed?.direction === "EVEN") {
        // Waiting for an even digit within 3 ticks.
        if (digit % 2 === 0) {
          st.runIndex += 1;
          events.push(
            this.mk(st, "ENTER", "EVEN", digit,
              `ENTER EVEN — even digit ${digit} confirmed after least-pair odd trigger.`, freq),
          );
          this.afterEnter(st, events, freq);
          st.primed = null;
        } else {
          st.primed.ticksLeft -= 1;
          if (st.primed.ticksLeft <= 0) st.primed = null;
        }
      }
    } else if (activeSetup === "ODD") {
      // Prime when the least-appearing pair digit appears.
      if (!st.primed && isLeastPair(digit)) {
        st.primed = { direction: "ODD", ticksLeft: 5, consecutiveOdd: 0 };
      } else if (st.primed?.direction === "ODD") {
        if (digit % 2 === 1) {
          st.primed.consecutiveOdd += 1;
          if (st.primed.consecutiveOdd >= 2) {
            st.runIndex += 1;
            events.push(
              this.mk(st, "ENTER", "ODD", digit,
                `ENTER ODD — 2 consecutive odd digits confirmed (…${digit}).`, freq),
            );
            this.afterEnter(st, events, freq);
            st.primed = null;
          }
        } else {
          // even digit breaks the consecutive-odd requirement
          st.primed.consecutiveOdd = 0;
        }
        if (st.primed) {
          st.primed.ticksLeft -= 1;
          if (st.primed.ticksLeft <= 0) st.primed = null;
        }
      }
    }

    return events;
  }

  private afterEnter(st: InternalState, events: EngineEvent[], freq: Frequencies) {
    if (st.runIndex >= STOP_THRESHOLD) {
      st.paused = true;
      events.push(
        this.mk(st, "STOP", st.lastSetup === "NONE" ? "EVEN" : st.lastSetup, null,
          `STOP — ${st.runIndex} consecutive runs reached. Pausing for market re-confirmation.`, freq),
      );
    }
  }

  private mk(
    st: InternalState,
    kind: EventKind,
    direction: Direction,
    triggerDigit: number | null,
    message: string,
    freq: Frequencies,
  ): EngineEvent {
    return {
      id: nextId(),
      symbol: st.symbol,
      symbolName: st.symbolName,
      kind,
      direction,
      message,
      triggerDigit,
      runIndex: st.runIndex,
      frequencies: freq.pct.map((p) => Math.round(p * 100) / 100),
      createdAt: Date.now(),
    };
  }

  /** Build the full view model for rendering a market card. */
  getView(symbol: string): MarketView | null {
    const st = this.states.get(symbol);
    if (!st) return null;
    const freq = computeFrequencies(st.digits);
    const ranking = assignColors(freq);
    const even = evaluateEven(ranking, freq);
    const odd = evaluateOdd(ranking, freq);

    let dominant: Direction | "NONE" = "NONE";
    let dominantReason = "Buffering ticks…";
    if (st.digits.length >= MIN_SAMPLE) {
      if (even.dominant && freq.evenPct >= freq.oddPct) {
        dominant = "EVEN";
        dominantReason = `EVEN leads ${round(freq.evenPct)}% vs ${round(freq.oddPct)}%`;
      } else if (odd.dominant && freq.oddPct > freq.evenPct) {
        dominant = "ODD";
        dominantReason = `ODD leads ${round(freq.oddPct)}% vs ${round(freq.evenPct)}%`;
      } else {
        dominant = freq.evenPct >= freq.oddPct ? "EVEN" : "ODD";
        dominantReason = `Weak lead: EVEN ${round(freq.evenPct)}% / ODD ${round(freq.oddPct)}% (not confirmed)`;
      }
    }

    const activeSetup: Direction | "NONE" =
      even.setupValid && even.dominant
        ? "EVEN"
        : odd.setupValid && odd.dominant
          ? "ODD"
          : "NONE";

    const digits = st.digits;
    const lastDigit = digits.length ? digits[digits.length - 1] : null;

    return {
      symbol: st.symbol,
      symbolName: st.symbolName,
      digits: digits.slice(-WINDOW_SIZE),
      lastDigit,
      analysisCount: digits.length,
      frequencies: freq,
      trends: computeTrends(digits),
      ranking,
      even,
      odd,
      dominant,
      dominantReason,
      activeSetup,
      primed: st.primed ? { ...st.primed } : null,
      runIndex: st.runIndex,
      paused: st.paused,
      lastUpdate: st.lastUpdate,
    };
  }

  symbols(): string[] {
    return [...this.states.keys()];
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
