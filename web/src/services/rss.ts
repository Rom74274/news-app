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

// rss2json.com : convertit le RSS en JSON, gère le CORS, gratuit (10k req/jour)
const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";

const MAX_PER_CATEGORY = 10;

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

// rss2json retourne "2026-04-14 11:46:50" (espace) que Safari ne parse pas.
// On remplace l'espace par "T" pour obtenir un format ISO valide partout.
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
          id: btoa(
            unescape(encodeURIComponent(`${source.name}::${item.link || item.title}`))
          ).slice(0, 32),
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
