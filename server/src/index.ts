import express from "express";
import cors from "cors";
import { fetchAllRSS, RawArticle } from "./rss";
import { summarizeArticles, ArticleSummary } from "./summarizer";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let newsCache: {
  articles: any[];
  fetchedAt: number;
} | null = null;

const NEWS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCacheKey(article: RawArticle): string {
  return `${article.source}::${article.link || article.title}`;
}

async function getEnrichedNews() {
  if (newsCache && Date.now() - newsCache.fetchedAt < NEWS_CACHE_TTL) {
    return newsCache.articles;
  }

  console.log("[News] Récupération des flux RSS...");
  const rawArticles = await fetchAllRSS();
  console.log(`[News] ${rawArticles.length} articles récupérés`);

  console.log(`[News] Résumé de ${rawArticles.length} articles via Claude Haiku...`);

  const summaries = await summarizeArticles(rawArticles);

  const fallback: ArticleSummary = {
    headline: "",
    who: "—",
    what: "Pas de résumé disponible.",
    why: "—",
  };

  const enriched = rawArticles.map((article) => {
    const key = getCacheKey(article);
    const summary = summaries.get(key) || fallback;

    return {
      id: Buffer.from(key).toString("base64url").slice(0, 32),
      title: article.title,
      headline: summary.headline || article.title,
      who: summary.who,
      what: summary.what,
      why: summary.why,
      source: article.source,
      sourceIcon: article.sourceIcon,
      category: article.category,
      publishedAt: article.publishedAt,
      link: article.link,
    };
  });

  newsCache = { articles: enriched, fetchedAt: Date.now() };
  console.log("[News] Cache mis à jour");

  return enriched;
}

app.get("/api/news", async (_req, res) => {
  try {
    const articles = await getEnrichedNews();
    res.json({ articles, updatedAt: newsCache?.fetchedAt });
  } catch (error) {
    console.error("[API] Erreur:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des news" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    cacheAge: newsCache ? Math.round((Date.now() - newsCache.fetchedAt) / 1000) : null,
    articlesCount: newsCache?.articles.length || 0,
  });
});

app.listen(PORT, () => {
  console.log(`\n🗞️  Actu Express API démarrée sur http://localhost:${PORT}`);
  console.log(`   GET /api/news    → Articles enrichis`);
  console.log(`   GET /api/health  → Status du serveur\n`);

  getEnrichedNews().catch(console.error);
});
