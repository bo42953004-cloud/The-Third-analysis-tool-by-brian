# Deriv Digit Analyzer — EVEN/ODD Strategy Engine

A real-time trading analysis tool that connects to the **Deriv WebSocket API**,
streams tick data for every volatility (synthetic) market, and evaluates
EVEN / ODD entry conditions based on color-ranked digit frequency patterns.

Built with **Next.js (App Router)**, **PostgreSQL + Drizzle ORM**, and a
browser-side WebSocket client so ticks stream directly from Deriv with minimal
latency.

---

## How it works

### 1. Data collection
- The browser opens `wss://ws.derivws.com/websockets/v3?app_id=<APP_ID>`.
- It requests `active_symbols` and subscribes to `ticks` for every
  `synthetic_index` market whose symbol starts with `R_` or `1HZ`
  (Volatility 10/25/50/75/100 and their 1-second variants).
- For each tick, the **last decimal digit** of the quote is extracted using the
  market's `pip_size` precision.
- The last **30 digits** are kept in a rolling window per market and labeled
  EVEN or ODD.

### 2. Frequency & color ranking
For each market the engine computes the appearance % of digits `0-9` and ranks
them into six colors:

| Color   | Meaning              |
| ------- | -------------------- |
| GREEN   | Most frequent digit  |
| BLUE    | 2nd most frequent    |
| PURPLE  | 3rd most frequent    |
| RED     | Least frequent       |
| YELLOW  | 2nd least frequent   |
| BROWN   | 3rd least frequent   |

### 3. Condition evaluation

**EVEN market (all must hold):**
- GREEN, BLUE, PURPLE bars sit on **even** digits.
- BLUE and GREEN each above **11%**.
- RED, BROWN, YELLOW on **odd** digits (or a mix).
- RED ≤ **9%**, YELLOW ≤ **9.5%**.
- **Dominance:** even % > odd %, and the strongest odd digit ≤ **10.3%**.
- **Entry trigger:** once the least-appearing pair (RED/YELLOW) prints an odd
  digit, wait for an even digit within the next **3 ticks** → `ENTER`.

**ODD market (all must hold):**
- GREEN, PURPLE, BLUE on **odd** digits, each **11%+**.
- RED, BROWN, YELLOW on **even** digits.
- RED ≤ **9%**, YELLOW ≤ **9.5%**.
- **Dominance:** odd % > even %, and the strongest even digit ≤ **10.3%**.
- **Entry trigger:** once the least-appearing pair prints, wait for **2
  consecutive odd digits** within the next **5 ticks** → `ENTER`.

**Stop condition:** after **6** consecutive runs (within the 5–7 range) the
market is paused until the setup breaks and re-confirms.

### 4. Signals & alerts
- `ENTER` — full conditions met and trigger fired (green toast + saved to DB).
- `WARNING` — setup valid but dominance slipping / about to break.
- `STOP` — run threshold reached; pause for re-confirmation.
- `SETUP` — a fresh valid setup formed, awaiting trigger.

`ENTER` and `STOP` events are persisted to PostgreSQL via `POST /api/signals`.

---

## UI overview
- **Market cards** — EVEN/ODD split, color-coded frequency bars, last 30 digits,
  live condition checklist (toggle EVEN/ODD), prime countdown, dominance badge.
- **Active Signals window** — chronological feed of ENTER/STOP/WARNING/SETUP.
- **Alert banner** — floating toast for the latest high-priority event.
- **Filters** — ALL / SETUP / EVEN / ODD.
- **Connection status** with auto-reconnect (exponential backoff) + manual
  reconnect button.

## Configuration
- `NEXT_PUBLIC_DERIV_APP_ID` — Deriv application id (defaults to `1089`, the
  public test id). Set your own for production.
- `DATABASE_URL` — PostgreSQL connection string (already wired via Drizzle).

## API
- `GET /api/health` — DB connectivity check.
- `GET /api/signals` — latest 100 persisted signals.
- `POST /api/signals` — persist a signal event.

## Data model (`src/db/schema.ts`)
- `signals` — persisted ENTER/STOP/WARNING/SETUP events.
- `snapshots` — periodic frequency snapshots for historical analysis.

## Disclaimer
This is an **educational analysis tool**. Synthetic index behaviour is random;
the signals are statistical observations and **not financial advice**.
