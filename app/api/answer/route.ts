import { NextResponse } from "next/server";
import { summarize } from "@/lib/ai";
import { search } from "@/lib/search";
import { allow, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_QUERY = 300;

export async function POST(req: Request) {
  try {
    // AI-сводка жжёт токены — жёсткий лимит: 15/час на IP.
    if (!allow(clientIp(req), 15, 3_600_000)) {
      return NextResponse.json(
        { error: "Лимит AI-сводок исчерпан, попробуй позже." },
        { status: 429 }
      );
    }
    const { question } = (await req.json()) as { question?: string };
    if (!question || typeof question !== "string" || question.trim().length < 2) {
      return NextResponse.json({ error: "question too short" }, { status: 400 });
    }
    const q = question.trim().slice(0, MAX_QUERY);
    // Ищем 25 для показа списком, в LLM уйдёт топ-10 (контроль токенов внутри summarize).
    const sources = await search(q, 25);
    const result = await summarize(q, sources);
    return NextResponse.json({
      question: q,
      answer: result.answer,
      model: result.model,
      usedAi: result.usedAi,
      sources,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
