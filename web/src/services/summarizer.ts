import type { RawArticle } from "./rss";
import { API_URL } from "./api";

export type Topic =
  | "géopolitique"
  | "économie"
  | "société"
  | "tech"
  | "culture"
  | "sport"
  | "faits divers"
  | "autre";

export interface ArticleSummary {
  headline: string;
  who: string;
  what: string[];
  why: string[];
  topic: Topic;
  importance: number;
}

const STORAGE_KEY = "actu-express:summaries";
const SCHEMA_VERSION = "v2-bullets";
const SCHEMA_KEY = "actu-express:schema";
const TTL_MS = 14 * 24 * 3600 * 1000;

if (typeof localStorage !== "undefined") {
  try {
    if (localStorage.getItem(SCHEMA_KEY) !== SCHEMA_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("actu-express:articles");
      localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
    }
  } catch {
    // pas de localStorage : on ignore
  }
}

interface CachedSummary extends ArticleSummary {
  _ts: number;
}

function loadCache(): Map<string, CachedSummary> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, CachedSummary & { what: unknown; why: unknown }>;
    const now = Date.now();
    const map = new Map<string, CachedSummary>();
    for (const [k, v] of Object.entries(obj)) {
      if (!v || now - v._ts >= TTL_MS) continue;
      map.set(k, {
        ...v,
        what: Array.isArray(v.what) ? v.what : [String(v.what ?? "—")],
        why: Array.isArray(v.why) ? v.why : [String(v.why ?? "—")],
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveCache(map: Map<string, CachedSummary>) {
  try {
    const obj: Record<string, CachedSummary> = {};
    for (const [k, v] of map) obj[k] = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // quota dépassé : on ignore
  }
}

const cache = loadCache();

let lastDiagnostic = "";
export function getLastDiagnostic(): string {
  return lastDiagnostic;
}
function setDiagnostic(msg: string) {
  lastDiagnostic = msg;
}
export function countUncached(articles: RawArticle[]): number {
  let n = 0;
  for (const a of articles) if (!cache.has(a.id)) n++;
  return n;
}

export async function summarizeArticles(
  articles: RawArticle[]
): Promise<Map<string, ArticleSummary>> {
  const results = new Map<string, ArticleSummary>();
  const toSummarize: RawArticle[] = [];

  for (const article of articles) {
    const cached = cache.get(article.id);
    if (cached) {
      results.set(article.id, cached);
    } else {
      toSummarize.push(article);
    }
  }

  if (toSummarize.length === 0) {
    return results;
  }

  let okCount = 0;
  let errCount = 0;
  let lastErr = "";

  const CONCURRENCY = 4;
  for (let i = 0; i < toSummarize.length; i += CONCURRENCY) {
    const batch = toSummarize.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map((a) =>
        summarizeOne(a)
          .then((s) => ({ summary: s, ok: true as const, err: "" }))
          .catch((e) => ({
            summary: fallback(a),
            ok: false as const,
            err: e instanceof Error ? e.message : String(e),
          }))
      )
    );
    settled.forEach(({ summary, ok, err }, idx) => {
      const article = batch[idx];
      results.set(article.id, summary);
      if (ok) {
        okCount++;
        cache.set(article.id, { ...summary, _ts: Date.now() });
      } else {
        errCount++;
        lastErr = err;
      }
    });
  }
  saveCache(cache);

  if (errCount > 0) {
    setDiagnostic(`${okCount} OK / ${errCount} erreur — ${lastErr}`);
  } else if (okCount > 0) {
    setDiagnostic(`${okCount} résumé(s) OK`);
  }

  return results;
}

// Le prompt et la clé Anthropic sont dans le Worker (worker/src/index.ts)
async function summarizeOne(article: RawArticle): Promise<ArticleSummary> {
  const res = await fetch(`${API_URL}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: article.source,
      title: article.title,
      description: (article.description || "").slice(0, 2000),
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.warn("[Claude] HTTP", res.status, errBody);
    throw new Error(`Résumé HTTP ${res.status}`);
  }

  const data = await res.json();
  const text: string = data?.text || "";

  const parsed = extractJson(text);
  if (!parsed) throw new Error("Claude JSON parse failed");

  return {
    headline: str(parsed.headline) || article.title,
    who: str(parsed.who) || "—",
    what: toBullets(parsed.what, article.description),
    why: toBullets(parsed.why, ""),
    topic: normalizeTopic(parsed.topic),
    importance: clampImportance(parsed.importance),
  };
}

function toBullets(v: unknown, fallbackText: string): string[] {
  if (Array.isArray(v)) {
    const arr = v.map((x) => str(x).replace(/^[-•·*]\s*/, "")).filter(Boolean);
    if (arr.length > 0) return arr;
  }
  if (typeof v === "string" && v.trim()) {
    // tolère ancien format string : on splitte sur points/retours pour générer des bullets
    return v
      .split(/(?:\r?\n|(?<=[.!?])\s+(?=[A-ZÉÈÀÂÊÎÔÛÇ]))/)
      .map((s) => s.trim().replace(/^[-•·*]\s*/, ""))
      .filter(Boolean);
  }
  return fallbackText ? [fallbackText] : ["—"];
}

const TOPICS: Topic[] = [
  "géopolitique",
  "économie",
  "société",
  "tech",
  "culture",
  "sport",
  "faits divers",
  "autre",
];

function normalizeTopic(v: unknown): Topic {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  const found = TOPICS.find((t) => t === s);
  if (found) return found;
  if (s.includes("divers")) return "faits divers";
  if (s.includes("écon") || s.includes("econ")) return "économie";
  if (s.includes("géop") || s.includes("geop") || s.includes("guerre")) return "géopolitique";
  return "autre";
}

function clampImportance(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function fallback(article: RawArticle): ArticleSummary {
  return {
    headline: article.title,
    who: "—",
    what: [article.description || "—"],
    why: ["—"],
    topic: "autre",
    importance: 5,
  };
}
