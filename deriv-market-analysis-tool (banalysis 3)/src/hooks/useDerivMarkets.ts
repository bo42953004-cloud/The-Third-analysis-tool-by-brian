"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DERIV_WS_URL,
  FALLBACK_SYMBOLS,
  decimalsFromPip,
  lastDigit,
  type DerivSymbol,
} from "@/lib/deriv";
import { ANALYSIS_WINDOW } from "@/lib/analysis";
import { MarketEngine, type EngineEvent, type MarketView } from "@/lib/engine";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "closed";

interface UseDerivResult {
  status: ConnectionStatus;
  views: MarketView[];
  events: EngineEvent[];
  error: string | null;
  reconnect: () => void;
}

const MAX_EVENTS = 200;

export function useDerivMarkets(): UseDerivResult {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [views, setViews] = useState<MarketView[]>([]);
  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const engineRef = useRef<MarketEngine>(new MarketEngine());
  const decimalsRef = useRef<Map<string, number>>(new Map());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const manualClose = useRef(false);

  const persistEvent = useCallback((ev: EngineEvent) => {
    // Only persist meaningful events (not raw setups spam is fine too).
    fetch("/api/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: ev.symbol,
        symbolName: ev.symbolName,
        direction: ev.direction,
        kind: ev.kind,
        message: ev.message,
        triggerDigit: ev.triggerDigit,
        frequencies: ev.frequencies,
        runIndex: ev.runIndex,
      }),
    }).catch(() => {
      /* best-effort persistence; ignore network errors */
    });
  }, []);

  const connect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    manualClose.current = false;
    setStatus(attemptRef.current === 0 ? "connecting" : "reconnecting");

    let ws: WebSocket;
    try {
      ws = new WebSocket(DERIV_WS_URL);
    } catch {
      setStatus("error");
      setError("Unable to open WebSocket");
      return;
    }
    wsRef.current = ws;

    const subscribe = (symbols: DerivSymbol[]) => {
      for (const s of symbols) {
        decimalsRef.current.set(s.symbol, decimalsFromPip(s.pip));
        engineRef.current.register(s.symbol, s.display_name);
        // ticks_history seeds a large accurate sample AND subscribes to live
        // ticks in a single request.
        ws.send(
          JSON.stringify({
            ticks_history: s.symbol,
            count: ANALYSIS_WINDOW,
            end: "latest",
            style: "ticks",
            subscribe: 1,
          }),
        );
      }
    };

    ws.onopen = () => {
      attemptRef.current = 0;
      setStatus("connected");
      setError(null);
      // Ask for the list of tradable synthetic markets.
      ws.send(
        JSON.stringify({ active_symbols: "brief", product_type: "basic" }),
      );
    };

    ws.onmessage = (msg) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(msg.data as string);
      } catch {
        return;
      }

      if (data.error) {
        const err = data.error as { message?: string };
        setError(err.message ?? "Deriv API error");
        return;
      }

      if (data.msg_type === "active_symbols" && Array.isArray(data.active_symbols)) {
        const all = data.active_symbols as Array<Record<string, unknown>>;
        // Index live symbol metadata (supports both legacy and new field names).
        const meta = new Map<string, DerivSymbol>();
        for (const s of all) {
          const sym = String(s.symbol ?? s.underlying_symbol ?? "");
          if (!sym) continue;
          meta.set(sym, {
            symbol: sym,
            display_name: String(
              s.display_name ?? s.underlying_symbol_name ?? sym,
            ),
            pip: typeof s.pip === "number" ? (s.pip as number) : 0.01,
          });
        }
        // Subscribe to exactly our allow-list, enriching with live pip/name when
        // available and falling back to our defaults otherwise.
        const list = FALLBACK_SYMBOLS.map((fb) => meta.get(fb.symbol) ?? fb);
        subscribe(list);
        return;
      }

      if (data.msg_type === "history" && data.history) {
        const echo = (data.echo_req ?? {}) as { ticks_history?: string };
        const symbol = echo.ticks_history;
        const history = data.history as { prices?: Array<number | string> };
        if (symbol && Array.isArray(history.prices)) {
          const decimals = decimalsRef.current.get(symbol) ?? 2;
          const digits = history.prices.map((p) =>
            lastDigit(typeof p === "string" ? parseFloat(p) : p, decimals),
          );
          engineRef.current.seedHistory(symbol, digits);
        }
        return;
      }

      if (data.msg_type === "tick" && data.tick) {
        const tick = data.tick as {
          symbol: string;
          quote: number;
          pip_size?: number;
        };
        // tick.pip_size is the authoritative number of decimal places — always
        // prefer it so the last digit matches Deriv exactly.
        if (typeof tick.pip_size === "number") {
          decimalsRef.current.set(tick.symbol, tick.pip_size);
        }
        const decimals = decimalsRef.current.get(tick.symbol);
        const digit = lastDigit(tick.quote, decimals ?? 2);
        const emitted = engineRef.current.processDigit(tick.symbol, digit);
        if (emitted.length) {
          setEvents((prev) => {
            const next = [...emitted.reverse(), ...prev].slice(0, MAX_EVENTS);
            return next;
          });
          for (const ev of emitted) {
            if (ev.kind === "ENTER" || ev.kind === "STOP") persistEvent(ev);
          }
        }
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error");
    };

    ws.onclose = () => {
      if (manualClose.current) {
        setStatus("closed");
        return;
      }
      setStatus("reconnecting");
      attemptRef.current += 1;
      const delay = Math.min(1000 * 2 ** attemptRef.current, 15000);
      reconnectTimer.current = setTimeout(connect, delay);
    };
  }, [persistEvent]);

  const reconnect = useCallback(() => {
    attemptRef.current = 0;
    if (wsRef.current) {
      manualClose.current = true;
      wsRef.current.close();
    }
    connect();
  }, [connect]);

  // Refresh the view models on a steady cadence (ticks are far too frequent
  // to re-render on every message).
  useEffect(() => {
    const interval = setInterval(() => {
      const engine = engineRef.current;
      const next = engine
        .symbols()
        .map((s) => engine.getView(s))
        .filter((v): v is MarketView => v !== null)
        .sort((a, b) => a.symbolName.localeCompare(b.symbolName));
      setViews(next);
    }, 250);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      manualClose.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, views, events, error, reconnect };
}
