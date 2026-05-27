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
      // V3 (chat), а не R1: R1 рассуждает дольше 60с → таймаут функции Vercel.
      // Качество тянем промптом + контекстом, а не медленной reasoning-моделью.
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

  // В LLM шлём до 20 тредов — нужна широта, чтобы поймать ПОВТОРЯЮЩИЕСЯ
  // советы (частотность важнее для вопросов вроде "какие шины брать").
  const top = threads.slice(0, 20);
  const context = top.length
    ? top
        .map((t, i) =>
          [
            `Обсуждение ${i + 1} (${fmtDate(t.start_date)}, сообщений: ${t.message_count}, реакций: ${t.reactions_total}):`,
            t.text.slice(0, 2800),
          ].join("\n")
        )
        .join("\n\n---\n\n")
    : "Подходящих обсуждений в базе нет.";

  const system = [
    "Ты эксперт-консультант по Hyundai Palisade. Перед тобой реальные обсуждения владельцев из Telegram.",
    "Дай КОНКРЕТНЫЙ ответ, как живой опытный владелец — без воды и общих фраз.",
    "ГЛАВНОЕ ПРАВИЛО: считай частотность. Если конкретную марку/модель/деталь/решение советуют НЕСКОЛЬКО человек — это и есть главный совет сообщества, назови его ПЕРВЫМ и прямо («Большинство берёт X»).",
    "Называй конкретику: марки, модели, артикулы, цифры, цены, интервалы — ровно как в тредах. НЕ обобщай («китайские шины», «разные масла») — перечисляй конкретные названия, которые звучат, и кто что хвалит/ругает.",
    "Структура: 1) прямой ответ-вывод (что брать/делать) в 1-2 предложениях; 2) конкретика и альтернативы списком, с пометкой что популярнее; 3) на что жалуются / подводные камни.",
    "НЕ ПУТАЙ КАТЕГОРИИ ТОВАРОВ. Отвечай строго на заданный вопрос. Моторное масло, AdBlue/мочевина (Niagara, Лукойл AdBlue и т.п.), антифриз/охлаждайка, трансмиссионное масло — это РАЗНЫЕ вещи. Если спросили про моторное масло — пиши только про моторное масло, не приплетай AdBlue, экологию, мочевину или другие жидкости.",
    "Отвечай по-русски. Опирайся ТОЛЬКО на переданные обсуждения, ничего не выдумывай. Если данных реально мало — так и скажи, не лей воду.",
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
      temperature: 0.3,
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI request failed ${response.status}: ${body.slice(0, 300)}`);
  }

  const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  let answer = json.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("AI response is empty");
  // У рассуждающих моделей (R1) в content иногда просачивается блок <think>…</think> — срезаем.
  answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  return { answer, model: config.model, usedAi: true };
}
