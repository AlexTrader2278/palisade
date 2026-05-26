import type { SearchResult } from "./search";

type Provider = "openrouter" | "openai";

function resolveProvider(): { provider: Provider; apiKey: string; baseUrl: string; model: string } | null {
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const provider = (process.env.AI_PROVIDER?.trim() as Provider | undefined) ?? (openrouterKey ? "openrouter" : openaiKey ? "openai" : undefined);
  if (!provider) return null;

  if (provider === "openrouter") {
    if (!openrouterKey) return null;
    return {
      provider,
      apiKey: openrouterKey,
      baseUrl: process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
      model: process.env.AI_MODEL?.trim() || "openai/gpt-4o-mini",
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

export async function generateAnswer(question: string, sources: SearchResult[]): Promise<{ answer: string; model: string; usedAi: boolean }> {
  const config = resolveProvider();
  const context = sources.length
    ? sources
        .map(
          (item, index) =>
            `Источник ${index + 1}: ${item.title}\nТема: ${item.topic}\nФрагмент: ${item.excerpt}\n`
        )
        .join("\n")
    : "Подходящих источников в базе нет.";

  const system = [
    "Ты помощник по базе знаний владельцев Hyundai Palisade.",
    "Отвечай по-русски, коротко и по делу.",
    "Опирайся только на переданный контекст.",
    "Если данных не хватает, честно скажи, что в базе нет уверенного ответа.",
    "В конце добавь короткий блок 'Источники' с перечислением использованных источников.",
  ].join(" ");

  if (!config) {
    const fallback = sources.length
      ? `По базе нашёлся полезный контекст:\n\n${sources
          .map((item, index) => `• ${index + 1}. ${item.title}: ${item.excerpt}`)
          .join("\n")}`
      : "Пока в локальной базе нет подходящего ответа. Добавь больше материалов или переформулируй вопрос.";
    return { answer: fallback, model: "local-fallback", usedAi: false };
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.provider === "openrouter" ? { "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000", "X-Title": "Palisade Owners AI" } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Вопрос: ${question}\n\nКонтекст:\n${context}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI request failed ${response.status}: ${body.slice(0, 300)}`);
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const answer = json.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error("AI response is empty");
  }
  return { answer, model: config.model, usedAi: true };
}
