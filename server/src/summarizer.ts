import Anthropic from "@anthropic-ai/sdk";
import { RawArticle } from "./rss";

const anthropic = new Anthropic();

export interface ArticleSummary {
  headline: string;
  who: string;
  what: string;
  why: string;
}

// Cache des résumés
const summaryCache = new Map<string, { data: ArticleSummary; cachedAt: number }>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 heures

function getCacheKey(article: RawArticle): string {
  return `${article.source}::${article.link || article.title}`;
}

export async function summarizeArticles(
  articles: RawArticle[]
): Promise<Map<string, ArticleSummary>> {
  const results = new Map<string, ArticleSummary>();
  const toSummarize: RawArticle[] = [];

  for (const article of articles) {
    const key = getCacheKey(article);
    const cached = summaryCache.get(key);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      results.set(key, cached.data);
    } else {
      toSummarize.push(article);
    }
  }

  if (toSummarize.length === 0) return results;

  const batchSize = 10;
  for (let i = 0; i < toSummarize.length; i += batchSize) {
    const batch = toSummarize.slice(i, i + batchSize);
    const batchResults = await summarizeBatch(batch);

    for (const [key, data] of batchResults) {
      results.set(key, data);
      summaryCache.set(key, { data, cachedAt: Date.now() });
    }
  }

  return results;
}

async function summarizeBatch(
  articles: RawArticle[]
): Promise<Map<string, ArticleSummary>> {
  const results = new Map<string, ArticleSummary>();

  const articlesText = articles
    .map(
      (a, i) =>
        `[ARTICLE ${i + 1}] Source: ${a.source}\nTitre: ${a.title}\nContenu: ${a.description}`
    )
    .join("\n\n---\n\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Tu es un rédacteur en chef qui synthétise l'actualité pour des lecteurs pressés. Pour chaque article, produis :
- Un HEADLINE percutant (1-2 phrases max) qui résume l'actu de manière claire et directe
- QUI : les acteurs impliqués (personnes, organisations, pays)
- QUOI : ce qui s'est passé concrètement, les faits
- POURQUOI : le contexte, les enjeux, pourquoi c'est important

Règles :
- Sois factuel et précis, pas de blabla
- Si l'article est en anglais, réponds en français
- Chaque champ doit être concis mais informatif (1-2 phrases)
- Pas de formules creuses comme "Cet article..." ou "Il est important de noter..."

Format STRICT (JSON array) :
[
  {
    "id": 1,
    "headline": "...",
    "who": "...",
    "what": "...",
    "why": "..."
  }
]

${articlesText}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extraire le JSON de la réponse
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        id: number;
        headline: string;
        who: string;
        what: string;
        why: string;
      }>;

      for (const item of parsed) {
        const index = item.id - 1;
        if (index >= 0 && index < articles.length) {
          const key = getCacheKey(articles[index]);
          results.set(key, {
            headline: item.headline,
            who: item.who,
            what: item.what,
            why: item.why,
          });
        }
      }
    }

    // Fallback pour les articles non parsés
    for (const article of articles) {
      const key = getCacheKey(article);
      if (!results.has(key)) {
        results.set(key, fallbackSummary(article));
      }
    }
  } catch (error) {
    console.error("[Claude API] Erreur:", (error as Error).message);
    for (const article of articles) {
      const key = getCacheKey(article);
      results.set(key, fallbackSummary(article));
    }
  }

  return results;
}

function fallbackSummary(article: RawArticle): ArticleSummary {
  const desc = article.description || "Pas de détails disponibles.";
  return {
    headline: article.title,
    who: "—",
    what: desc.length > 150 ? desc.substring(0, 147) + "..." : desc,
    why: "—",
  };
}

// Nettoyage périodique du cache
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of summaryCache) {
    if (now - value.cachedAt > CACHE_TTL) {
      summaryCache.delete(key);
    }
  }
}, 60 * 60 * 1000);
