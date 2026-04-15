import type { RawArticle } from "./rss";

export interface ArticleSummary {
  headline: string;
  who: string;
  what: string;
  why: string;
}

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

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
    for (const a of toSummarize) {
      const fb = fallback(a);
      results.set(a.id, fb);
      cache.set(a.id, fb);
    }
    return results;
  }

  // Batch de 5 articles max pour que chaque résumé soit complet
  for (let i = 0; i < toSummarize.length; i += 5) {
    const batch = toSummarize.slice(i, i + 5);
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
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `Tu es un rédacteur en chef. Pour chaque article, produis un résumé structuré COMPLET.

Pour chaque article, remplis TOUS les champs :
- "headline" : 1-2 phrases percutantes résumant l'actu
- "who" : 2-3 phrases sur les acteurs impliqués (personnes, organisations, pays, rôles)
- "what" : 3-4 phrases détaillant ce qui s'est passé concrètement (les faits, les chiffres, les décisions)
- "why" : 2-3 phrases sur le contexte et les enjeux (pourquoi c'est important, quelles conséquences)

Règles :
- Sois factuel, précis et COMPLET. Ne tronque pas.
- Si l'article est en anglais, réponds en français
- Pas de formules creuses

Réponds UNIQUEMENT avec un JSON array valide, rien d'autre :
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
    what: article.description || "—",
    why: "—",
  };
}
