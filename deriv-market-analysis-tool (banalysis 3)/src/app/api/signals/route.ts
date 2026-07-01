import { db } from "@/db";
import { signals } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(signals)
      .orderBy(desc(signals.createdAt))
      .limit(100);
    return Response.json({ ok: true, signals: rows });
  } catch (e) {
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      symbol,
      symbolName,
      direction,
      kind,
      message,
      triggerDigit,
      frequencies,
      runIndex,
    } = body ?? {};

    if (!symbol || !direction || !kind || !message) {
      return Response.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const [row] = await db
      .insert(signals)
      .values({
        symbol,
        symbolName: symbolName ?? symbol,
        direction,
        kind,
        message,
        triggerDigit: typeof triggerDigit === "number" ? triggerDigit : null,
        frequencies: Array.isArray(frequencies) ? frequencies : null,
        runIndex: typeof runIndex === "number" ? runIndex : 0,
      })
      .returning();

    return Response.json({ ok: true, signal: row });
  } catch (e) {
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
