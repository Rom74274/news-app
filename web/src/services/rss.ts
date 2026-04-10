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
  { name: "Le Monde", url: "https://www.lemonde.fr/rss/une.xml", icon: "LM", category: "france" },
  { name: "France Info", url: "https://www.francetvinfo.fr/titres.rss", icon: "FI", category: "france" },
  { name: "Le Figaro", url: "https://www.lefigaro.fr/rss/figaro_actualites.xml", icon: "LF", category: "france" },
  { name: "Libération", url: "https://www.liberation.fr/arc/outboundfeeds/rss-all/collection/accueil-702702/?outputType=xml", icon: "Lib", category: "france" },
  { name: "France 24 FR", url: "https://www.france24.com/fr/rss", icon: "F24", category: "france" },
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", icon: "BBC", category: "monde" },
  { name: "France 24 EN", url: "https://www.france24.com/en/rss", icon: "F24", category: "monde" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", icon: "AJ", category: "monde" },
  { name: "RFI", url: "https://www.rfi.fr/fr/rss", icon: "RFI", category: "monde" },
];

// Proxy CORS gratuit pour fetcher les RSS depuis le navigateur
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

const MAX_PER_CATEGORY = 10;

function extractTag(xml: string, tag: string): string {
  const cdataRegex = new RegExp(
    `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i"
  );
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = regex.exec(xml);
  return match ? match[1].trim() : "";
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

async function fetchSource(source: RSSSource): Promise<RawArticle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(CORS_PROXY + encodeURIComponent(source.url), {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const xml = await res.text();
    const articles: RawArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const title = extractTag(itemXml, "title");
      const description = extractTag(itemXml, "description");
      const link = extractTag(itemXml, "link");
      const pubDate = extractTag(itemXml, "pubDate");

      if (!title) continue;

      const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();

      articles.push({
        id: btoa(`${source.name}::${link || title}`).slice(0, 32),
        title: cleanHtml(title),
        description: cleanHtml(description || ""),
        source: source.name,
        sourceIcon: source.icon,
        category: source.category,
        publishedAt,
        link: link || "",
      });
    }

    return articles;
  } catch (error) {
    console.warn(`[RSS] Erreur ${source.name}:`, error);
    return [];
  }
}

export async function fetchAllRSS(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    NEWS_SOURCES.map((source) => fetchSource(source))
  );

  const allArticles: RawArticle[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allArticles.push(...result.value);
    }
  }

  // Filtrer : uniquement depuis hier (J-1)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const recent = allArticles.filter(
    (a) => new Date(a.publishedAt).getTime() >= yesterday.getTime()
  );

  recent.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // Max 10 par catégorie
  const france = recent.filter((a) => a.category === "france").slice(0, MAX_PER_CATEGORY);
  const monde = recent.filter((a) => a.category === "monde").slice(0, MAX_PER_CATEGORY);

  return [...france, ...monde].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}
