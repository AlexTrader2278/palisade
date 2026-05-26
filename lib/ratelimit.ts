// Лёгкий in-memory rate-limit по IP. На Vercel живёт в рамках тёплого
// инстанса serverless-функции — не идеален при множестве инстансов, но
// дёшево отсекает одиночный абьюз/долбёжку без внешнего стораджа.

const buckets = new Map<string, number[]>();

// Чистим раз в N обращений, чтобы Map не рос бесконечно.
let calls = 0;
function gc(now: number, windowMs: number) {
  if (++calls % 500 !== 0) return;
  for (const [ip, arr] of buckets) {
    const fresh = arr.filter((t) => now - t < windowMs);
    if (fresh.length === 0) buckets.delete(ip);
    else buckets.set(ip, fresh);
  }
}

/** true = можно, false = лимит исчерпан. */
export function allow(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  gc(now, windowMs);
  const arr = (buckets.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(ip, arr);
    return false;
  }
  arr.push(now);
  buckets.set(ip, arr);
  return true;
}

/** IP клиента из заголовков Vercel. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
