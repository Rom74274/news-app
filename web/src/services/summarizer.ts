import type { RawArticle } from "./rss";

export interface ArticleSummary {
  headline: string;
  who: string;
  what: string;
  why: string;
}

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

// Cache en mémoire (survit tant que l'onglet est ouvert)
const cache = new Map<string, ArticleSummary>();

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

  if (toSummarize.length === 0 || !ANTHROPIC_API_KEY) {
    // Fallback sans clé API
    for (const a of toSummarize) {
      const fb = fallback(a);
      results.set(a.id, fb);
      cache.set(a.id, fb);
    }
    return results;
  }

  // Batch de 10
  for (let i = 0; i < toSummarize.length; i += 10) {
    const batch = toSummarize.slice(i, i + 10);
    const batchResults = await summarizeBatch(batch);
    for (const [id, summary] of batchResults) {
      results.set(id, summary);
      cache.set(id, summary);
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
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
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
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

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
          results.set(articles[index].id, {
            headline: item.headline,
            who: item.who,
            what: item.what,
            why: item.why,
          });
        }
      }
    }

    // Fallback pour ceux non parsés
    for (const a of articles) {
      if (!results.has(a.id)) {
        results.set(a.id, fallback(a));
      }
    }
  } catch (error) {
    console.error("[Claude] Erreur:", error);
    for (const a of articles) {
      results.set(a.id, fallback(a));
    }
  }

  return results;
}

function fallback(article: RawArticle): ArticleSummary {
  return {
    headline: article.title,
    who: "—",
    what: article.description.length > 150
      ? article.description.substring(0, 147) + "..."
      : article.description || "—",
    why: "—",
  };
}
