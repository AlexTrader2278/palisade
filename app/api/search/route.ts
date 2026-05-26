import { NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { query, limit } = (await req.json()) as { query?: string; limit?: number };
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return NextResponse.json({ error: "query too short" }, { status: 400 });
    }
    const results = searchKnowledge(query.trim(), limit ?? 5);
    return NextResponse.json({ query: query.trim(), results });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
