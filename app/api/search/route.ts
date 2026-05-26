import { NextResponse } from "next/server";
import { search } from "@/lib/search";
import { allow, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY = 300;

export async function POST(req: Request) {
  try {
    // Поиск дешёвый по LLM, но даёт egress. Мягкий лимит: 40/мин на IP.
    if (!allow(clientIp(req), 40, 60_000)) {
      return NextResponse.json({ error: "Слишком много запросов, подожди минуту." }, { status: 429 });
    }
    const { query, limit } = (await req.json()) as { query?: string; limit?: number };
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return NextResponse.json({ error: "query too short" }, { status: 400 });
    }
    const q = query.trim().slice(0, MAX_QUERY);
    const n = Math.min(Math.max(Number(limit) || 25, 1), 30);
    const results = await search(q, n);
    return NextResponse.json({ query: q, results });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
