export interface RSSSource {
  name: string;
  url: string;
  icon: string;
  category: "france" | "monde";
}

export interface RawArticle {
  id: string;
  title: string;
  description: string;
  source: string;
  sourceIcon: string;
  category: "france" | "monde";
  publishedAt: string;
  link: string;
}

const NEWS_SOURCES: RSSSource[] = [
  // France & Europe
  { name: "Le Monde", url: "https://www.lemonde.fr/rss/une.xml", icon: "LM", category: "france" },
  { name: "Le Figaro", url: "https://www.lefigaro.fr/rss/figaro_actualites.xml", icon: "LF", category: "france" },
  { name: "Euronews", url: "https://fr.euronews.com/rss", icon: "EN", category: "france" },
  // Monde
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", icon: "BBC", category: "monde" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", icon: "AJ", category: "monde" },
  { name: "RFI", url: "https://www.rfi.fr/fr/rss", icon: "RFI", category: "monde" },
];

const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
const MAX_PER_CAT_PER_DAY = 10;
const WINDOW_DAYS = 7;
const ARTICLE_STORAGE_KEY = "actu-express:articles";

interface Rss2JsonItem {
  title: string;
  pubDate: string;
  link: string;
  guid: string;
  description: string;
  content: string;
}

interface Rss2JsonResponse {
  status: string;
  items: Rss2JsonItem[];
}

function hashId(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

function parseDate(dateStr: string): string {
  try {
    const iso = dateStr.replace(" ", "T");
    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function fetchSource(source: RSSSource): Promise<RawArticle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(RSS2JSON + encodeURIComponent(source.url), {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data: Rss2JsonResponse = await res.json();

    if (data.status !== "ok") return [];

    return data.items
      .filter((item) => item.title)
      .map((item) => {
        const publishedAt = item.pubDate
          ? parseDate(item.pubDate)
          : new Date().toISOString();

        return {
          id: hashId(`${source.name}::${item.link || item.title}`),
          title: item.title,
          description: cleanHtml(item.description || item.content || ""),
          source: source.name,
          sourceIcon: source.icon,
          category: source.category,
          publishedAt,
          link: item.link || "",
        };
      });
  } catch (error) {
    console.warn(`[RSS] Erreur ${source.name}:`, error);
    return [];
  }
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadStoredArticles(): Map<string, RawArticle> {
  try {
    const raw = localStorage.getItem(ARTICLE_STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, RawArticle>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveStoredArticles(map: Map<string, RawArticle>) {
  try {
    const obj: Record<string, RawArticle> = {};
    for (const [k, v] of map) obj[k] = v;
    localStorage.setItem(ARTICLE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // quota dépassé : on ignore silencieusement
  }
}

export async function fetchAllRSS(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    NEWS_SOURCES.map((source) => fetchSource(source))
  );

  const fresh: RawArticle[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") fresh.push(...result.value);
  }

  // Merge fresh + persisté pour accumuler la semaine
  const merged = loadStoredArticles();
  for (const a of fresh) merged.set(a.id, a);

  // TTL : on garde les WINDOW_DAYS derniers jours
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  cutoff.setHours(0, 0, 0, 0);
  for (const [id, a] of merged) {
    if (new Date(a.publishedAt).getTime() < cutoff.getTime()) merged.delete(id);
  }

  // Dédup par titre normalisé dans la même catégorie
  const seenTitles = new Set<string>();
  const deduped: RawArticle[] = [];
  for (const a of merged.values()) {
    const key = `${a.category}::${normalizeTitle(a.title)}`;
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    deduped.push(a);
  }

  // Cap par (catégorie × jour) pour limiter le coût Claude
  const groups = new Map<string, RawArticle[]>();
  for (const a of deduped) {
    const k = `${a.category}::${dayKey(a.publishedAt)}`;
    const list = groups.get(k) ?? [];
    list.push(a);
    groups.set(k, list);
  }
  const capped: RawArticle[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    capped.push(...list.slice(0, MAX_PER_CAT_PER_DAY));
  }

  // Persister la base élaguée pour la prochaine session
  const cappedIds = new Set(capped.map((a) => a.id));
  for (const id of merged.keys()) {
    if (!cappedIds.has(id)) merged.delete(id);
  }
  saveStoredArticles(merged);

  return capped.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}
