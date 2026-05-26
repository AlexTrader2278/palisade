import { NextResponse } from "next/server";
import { generateAnswer } from "@/lib/ai";
import { searchKnowledge } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { question } = (await req.json()) as { question?: string };
    if (!question || typeof question !== "string" || question.trim().length < 2) {
      return NextResponse.json({ error: "question too short" }, { status: 400 });
    }

    const sources = await searchKnowledge(question.trim(), 5);
    const result = await generateAnswer(question.trim(), sources);
    return NextResponse.json({
      question: question.trim(),
      answer: result.answer,
      model: result.model,
      usedAi: result.usedAi,
      sources,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
