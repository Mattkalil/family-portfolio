// Price service for the family portfolio dashboard.
//
// The website cannot ask Yahoo Finance for prices directly (browsers block it), so it asks this
// function instead. The function checks the caller is a signed-in family member, fetches prices
// and a year of daily history from Yahoo Finance, and keeps a copy in the price_cache table so
// several people looking at the dashboard do not each trigger their own Yahoo requests.
//
// To deploy: Supabase dashboard > Edge Functions > Deploy a new function > Via Editor,
// name it exactly "prices", paste this whole file, and press Deploy.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FRESH_SECONDS: Record<string, number> = { full: 6 * 3600, quote: 45 }; // how long a cached answer is reused
const MAX_SYMBOLS = 120;
const SYMBOL = /^[A-Z0-9.\-^=]{1,15}$/;
const SB = Deno.env.get("SUPABASE_URL") ?? "";

type Item = {
  name: string; currency: string; type: string; exchange: string; exchangeName: string;
  gmtoffset: number; price: number; time: number; t: number[]; c: number[];
  div?: number; sector?: string; industry?: string; stale?: boolean;
};
type Mode = "full" | "quote";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- who is calling -------------------------------------------------------------------------
function projectKey(req: Request): string {
  const h = req.headers.get("apikey");
  if (h) return h;
  try {
    const k = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    if (k.default) return k.default;
  } catch { /* fall through */ }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}
const verified = new Map<string, number>(); // token -> time until which we trust it
async function signedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const until = verified.get(auth);
  if (until && until > Date.now()) return true;
  // Only a real signed-in user's token gets a 200 here; the project's public key alone does not.
  const r = await fetch(`${SB}/auth/v1/user`, { headers: { Authorization: auth, apikey: projectKey(req) } });
  if (!r.ok) return false;
  if (verified.size > 500) verified.clear();
  verified.set(auth, Date.now() + 5 * 60_000);
  return true;
}

// ---- the shared cache (table price_cache), read and written as the signed-in user --------------
function dbHeaders(req: Request): Record<string, string> {
  return { Authorization: req.headers.get("Authorization") ?? "", apikey: projectKey(req), "Content-Type": "application/json" };
}
async function cacheGet(req: Request, symbols: string[], mode: Mode): Promise<Map<string, { item: Item; age: number }>> {
  const out = new Map<string, { item: Item; age: number }>();
  try {
    const list = symbols.map((s) => `"${s}"`).join(",");
    const url = `${SB}/rest/v1/price_cache?select=symbol,payload,fetched_at&mode=eq.${mode}&symbol=in.(${encodeURIComponent(list)})`;
    const r = await fetch(url, { headers: dbHeaders(req) });
    if (!r.ok) return out;
    for (const row of await r.json()) {
      out.set(row.symbol, { item: row.payload as Item, age: (Date.now() - Date.parse(row.fetched_at)) / 1000 });
    }
  } catch { /* the cache is a convenience; carry on without it */ }
  return out;
}
async function cachePut(req: Request, mode: Mode, fresh: Map<string, Item>): Promise<void> {
  if (!fresh.size) return;
  try {
    const now = new Date().toISOString();
    const rows = [...fresh].map(([symbol, payload]) => ({ symbol, mode, payload, fetched_at: now }));
    await fetch(`${SB}/rest/v1/price_cache?on_conflict=symbol,mode`, {
      method: "POST",
      headers: { ...dbHeaders(req), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
  } catch { /* ignore */ }
}

// ---- Yahoo Finance ----------------------------------------------------------------------------
async function yahoo(path: string): Promise<any> {
  let last = "Yahoo Finance did not answer";
  for (const host of ["query1", "query2"]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let r: Response;
      try {
        r = await fetch(`https://${host}.finance.yahoo.com${path}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
      } catch (e) {
        last = "Could not reach Yahoo Finance";
        break;
      }
      if (r.ok) return await r.json();
      if (r.status === 404) throw new Error("Yahoo Finance does not recognise this symbol");
      last = `Yahoo Finance answered with status ${r.status}`;
      await r.body?.cancel();
      if (r.status === 429) await sleep(500 * (attempt + 1)); else break; // 429 = asked too often: wait and retry
    }
  }
  throw new Error(last);
}
async function chart(symbol: string, mode: Mode): Promise<Item> {
  const query = mode === "full" ? "range=1y&interval=1d&events=div" : "range=5d&interval=1d";
  const j = await yahoo(`/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`);
  const res = j?.chart?.result?.[0];
  if (!res) throw new Error(j?.chart?.error?.description ?? "Yahoo Finance has no data for this symbol");
  const m = res.meta ?? {};
  const ts: number[] = res.timestamp ?? [];
  const closes: (number | null)[] = res.indicators?.quote?.[0]?.close ?? [];
  const t: number[] = [], c: number[] = [];
  for (let i = 0; i < ts.length; i++) {
    const v = closes[i];
    if (typeof v === "number" && isFinite(v) && v > 0) { t.push(ts[i]); c.push(+v.toPrecision(8)); }
  }
  const price = typeof m.regularMarketPrice === "number" && m.regularMarketPrice > 0 ? m.regularMarketPrice : c[c.length - 1];
  if (!(price > 0)) throw new Error("Yahoo Finance has no price for this symbol");
  const item: Item = {
    name: m.longName ?? m.shortName ?? symbol,
    currency: m.currency ?? "",
    type: m.instrumentType ?? "",
    exchange: m.exchangeName ?? "",
    exchangeName: m.fullExchangeName ?? "",
    gmtoffset: m.gmtoffset ?? 0,
    price,
    time: m.regularMarketTime ?? t[t.length - 1] ?? 0,
    t, c,
  };
  if (mode === "full") {
    const since = Date.now() / 1000 - 365 * 86400;
    let div = 0;
    for (const d of Object.values(res.events?.dividends ?? {}) as any[]) {
      if (d && d.date >= since && typeof d.amount === "number") div += d.amount;
    }
    item.div = +div.toPrecision(8); // dividends per share over the last 12 months
    if (item.type === "EQUITY") Object.assign(item, await profile(symbol));
  }
  return item;
}
async function profile(symbol: string): Promise<{ sector?: string; industry?: string }> {
  try { // best effort: the search answer usually carries the company's sector
    const j = await yahoo(`/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=6&newsCount=0`);
    const q = (j?.quotes ?? []).find((x: any) => x?.symbol === symbol);
    if (!q) return {};
    return { sector: q.sector ?? q.sectorDisp ?? "", industry: q.industry ?? q.industryDisp ?? "" };
  } catch { return {}; }
}
async function pool<T>(items: string[], size: number, work: (s: string) => Promise<T>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await work(items[next++]);
  }));
}

// ---- the request handler ----------------------------------------------------------------------
async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!(await signedIn(req))) return json({ error: "Sign in first" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Send JSON" }, 400); }
  const mode: Mode = body?.mode === "full" ? "full" : "quote";
  const symbols: string[] = [...new Set((Array.isArray(body?.symbols) ? body.symbols : []).map((s: unknown) => String(s).trim().toUpperCase()))]
    .filter((s) => SYMBOL.test(s as string)).slice(0, MAX_SYMBOLS) as string[];
  if (!symbols.length) return json({ at: Date.now(), data: {} });

  const cached = await cacheGet(req, symbols, mode);
  const data: Record<string, Item | { error: string }> = {};
  const fresh = new Map<string, Item>();
  const todo: string[] = [];
  for (const s of symbols) {
    const hit = cached.get(s);
    if (hit && hit.age < FRESH_SECONDS[mode]) data[s] = hit.item; else todo.push(s);
  }
  await pool(todo, 5, async (s) => {
    try {
      const item = await chart(s, mode);
      data[s] = item; fresh.set(s, item);
    } catch (e) {
      const old = cached.get(s); // Yahoo failed: fall back to the last answer we have, however old
      data[s] = old ? { ...old.item, stale: true } : { error: (e as Error).message };
    }
  });
  await cachePut(req, mode, fresh);
  return json({ at: Date.now(), data });
}

Deno.serve(handle);
