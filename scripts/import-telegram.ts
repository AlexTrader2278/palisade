import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { getSupabaseServiceRole } from "../lib/supabase";

type TelegramMessage = {
  id?: number;
  type?: string;
  date?: string;
  from?: string;
  text?: string | Array<string | { text?: string }>;
};

type TelegramExport = {
  name?: string;
  messages?: TelegramMessage[];
};

type KnowledgeChunkInsert = {
  id: string;
  source: string;
  source_channel: string;
  message_id: string | null;
  author: string | null;
  posted_at: string | null;
  topic: string;
  title: string;
  content: string;
  tags: string[];
};

function normalizeText(input: TelegramMessage["text"]): string {
  if (!input) return "";
  if (typeof input === "string") return input.trim();
  return input
    .map((part) => (typeof part === "string" ? part : part.text ?? ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function guessTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags = new Set<string>();
  if (/масл|5w|0w|двигател/.test(lower)) tags.add("масло");
  if (/тормоз|диск|колод/.test(lower)) tags.add("тормоза");
  if (/дизел|crdi|топлив/.test(lower)) tags.add("дизель");
  if (/htrac|awd|раздат|муфт/.test(lower)) tags.add("awd");
  if (/камера|мультимед|парктрон|датчик/.test(lower)) tags.add("электроника");
  if (/шина|резин|давлен/.test(lower)) tags.add("шины");
  return [...tags];
}

function titleFromText(text: string): string {
  const first = text.split(/[.!?]/)[0]?.trim() || text.trim();
  return first.length > 90 ? `${first.slice(0, 87)}...` : first;
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    throw new Error("Usage: npm run import:telegram -- C:\\path\\to\\result.json [channel-name]");
  }

  const channel = process.argv[3] || basename(input, ".json");
  const raw = await readFile(input, "utf8");
  const parsed = JSON.parse(raw) as TelegramExport;
  const messages = parsed.messages ?? [];
  const rows = messages
    .filter((message) => message.type === "message")
    .map((message) => {
      const content = normalizeText(message.text);
      if (content.length < 30) return null;
      const idSeed = `${channel}:${message.id ?? ""}:${content}`;
      const id = createHash("sha1").update(idSeed).digest("hex");
      return {
        id,
        source: "telegram",
        source_channel: channel,
        message_id: message.id ? String(message.id) : null,
        author: message.from ?? null,
        posted_at: message.date ?? null,
        topic: "Hyundai Palisade",
        title: titleFromText(content),
        content,
        tags: guessTags(content),
      };
    })
    .filter((row): row is KnowledgeChunkInsert => row !== null);

  const supabase = getSupabaseServiceRole();
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("knowledge_chunks").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(error.message);
    console.log(`Imported ${Math.min(i + batch.length, rows.length)}/${rows.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
