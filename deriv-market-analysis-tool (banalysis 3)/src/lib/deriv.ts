/**
 * Deriv WebSocket helpers & constants.
 * Docs: https://api.deriv.com/  (endpoint /websockets/v3)
 */

export const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || "1089";
export const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`;

export interface DerivSymbol {
  symbol: string;
  display_name: string;
  pip: number; // pip size value (e.g. 0.01)
}

/**
 * Fallback list of volatility (synthetic) markets used if the active_symbols
 * request fails. Pip is a decimal step; decimals are derived from it.
 */
export const FALLBACK_SYMBOLS: DerivSymbol[] = [
  { symbol: "R_10", display_name: "Volatility 10 Index", pip: 0.001 },
  { symbol: "R_25", display_name: "Volatility 25 Index", pip: 0.001 },
  { symbol: "R_50", display_name: "Volatility 50 Index", pip: 0.0001 },
  { symbol: "R_75", display_name: "Volatility 75 Index", pip: 0.0001 },
  { symbol: "R_100", display_name: "Volatility 100 Index", pip: 0.01 },
  { symbol: "1HZ10V", display_name: "Volatility 10 (1s) Index", pip: 0.01 },
  { symbol: "1HZ25V", display_name: "Volatility 25 (1s) Index", pip: 0.01 },
  { symbol: "1HZ50V", display_name: "Volatility 50 (1s) Index", pip: 0.01 },
  { symbol: "1HZ75V", display_name: "Volatility 75 (1s) Index", pip: 0.01 },
  { symbol: "1HZ100V", display_name: "Volatility 100 (1s) Index", pip: 0.01 },
  // Jump Indices (JD)
  { symbol: "JD10", display_name: "Jump 10 Index", pip: 0.01 },
  { symbol: "JD25", display_name: "Jump 25 Index", pip: 0.01 },
  { symbol: "JD50", display_name: "Jump 50 Index", pip: 0.01 },
  { symbol: "JD75", display_name: "Jump 75 Index", pip: 0.01 },
  { symbol: "JD100", display_name: "Jump 100 Index", pip: 0.01 },
];

/**
 * Explicit allow-list of the markets we monitor. Using a fixed list (instead of
 * everything active_symbols returns) keeps the grid focused, avoids hitting the
 * concurrent-subscription limit, and guarantees exactly these markets show:
 * Volatility 10/25/50/75/100, their 1s variants, and Jump 10/25/50/75/100.
 * Note: Volatility 90 (1s) is intentionally excluded.
 */
export const MONITORED_SYMBOLS: string[] = FALLBACK_SYMBOLS.map((s) => s.symbol);

export function isMonitoredSymbol(symbol: string): boolean {
  return MONITORED_SYMBOLS.includes(symbol);
}

/** Number of decimal places implied by a pip size (0.001 -> 3). */
export function decimalsFromPip(pip: number): number {
  if (!pip || pip <= 0) return 2;
  const s = pip.toString();
  if (s.includes("e-")) {
    return parseInt(s.split("e-")[1], 10);
  }
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

/** Extract the last decimal digit of a quote respecting its pip precision. */
export function lastDigit(quote: number, decimals: number): number {
  const fixed = quote.toFixed(decimals);
  const ch = fixed[fixed.length - 1];
  const d = parseInt(ch, 10);
  return Number.isNaN(d) ? 0 : d;
}
