import type { ThreadResult } from "./search";

type Provider = "openrouter" | "openai";

function resolveProvider(): { provider: Provider; apiKey: string; baseUrl: string; model: string } | null {
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const provider =
    (process.env.AI_PROVIDER?.trim() as Provider | undefined) ??
    (openrouterKey ? "openrouter" : openaiKey ? "openai" : undefined);

  if (!provider) return null;

  if (provider === "openrouter") {
    if (!openrouterKey) return null;
    return {
      provider,
      apiKey: openrouterKey,
      baseUrl: process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
      model: process.env.AI_MODEL?.trim() || "deepseek/deepseek-chat",
    };
  }

  if (!openaiKey) return null;
  return {
    provider,
    apiKey: openaiKey,
    baseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
    model: process.env.AI_MODEL?.trim() || "gpt-4o-mini",
  };
}

function fmtDate(iso: string): string {
  return iso?.slice(0, 10) ?? "";
}

export async function summarize(
  question: string,
  threads: ThreadResult[]
): Promise<{ answer: string; model: string; usedAi: boolean }> {
  const config = resolveProvider();

  // В LLM шлём только топ-10 тредов (контроль токенов под наплыв),
  // даже если на странице показываем больше.
  const top = threads.slice(0, 10);
  const context = top.length
    ? top
        .map((t, i) =>
          [
            `Обсуждение ${i + 1} (${fmtDate(t.start_date)}, сообщений: ${t.message_count}, реакций: ${t.reactions_total}):`,
            t.text.slice(0, 1500),
          ].join("\n")
        )
        .join("\n\n---\n\n")
    : "Подходящих обсуждений в базе нет.";

  const system = [
    "Ты помощник по базе обсуждений владельцев Hyundai Palisade из Telegram-сообщества.",
    "Тебе дают реальные треды обсуждений. Не пересказывай их по очереди — СИНТЕЗИРУЙ общий вывод.",
    "Структура ответа: 1) короткий вывод в 1-2 предложениях; 2) ключевые моменты списком (что советуют, какие есть мнения, на что жалуются); 3) если мнения расходятся — покажи это.",
    "Отвечай по-русски, по делу, без воды. Опирайся ТОЛЬКО на переданные обсуждения.",
    "Не выдумывай факты, цены, артикулы и регламенты, которых нет в тредах. Если данных мало — честно скажи.",
  ].join(" ");

  if (!config) {
    return {
      answer: "AI-суммаризация не настроена (нет OPENROUTER_API_KEY). Ниже — найденные обсуждения.",
      model: "none",
      usedAi: false,
    };
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.provider === "openrouter"
        ? {
            "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
            "X-Title": "Palisade Community Search",
          }
        : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Вопрос: ${question}\n\nОбсуждения из сообщества:\n${context}` },
      ],
      temperature: 0.2,
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI request failed ${response.status}: ${body.slice(0, 300)}`);
  }

  const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const answer = json.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("AI response is empty");

  return { answer, model: config.model, usedAi: true };
}
