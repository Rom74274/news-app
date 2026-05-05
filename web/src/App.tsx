import { useEffect, useState, useCallback } from "react";
import { format, isToday, isThisWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { fetchAllRSS, type RawArticle } from "./services/rss";
import {
  summarizeArticles,
  getLastDiagnostic,
  getApiKeyState,
  type ArticleSummary,
  type Topic,
} from "./services/summarizer";
import "./App.css";

interface NewsArticle {
  id: string;
  title: string;
  headline: string;
  who: string;
  what: string[];
  why: string[];
  topic: Topic;
  importance: number;
  source: string;
  sourceIcon: string;
  category: "france" | "monde";
  publishedAt: string;
  link: string;
}

const PER_DAY_PER_CATEGORY = 3;

type Category = "france" | "monde";
type Tab = "jour" | "semaine";

/* --- Carte dans la liste --- */
function NewsCard({
  article,
  onSelect,
}: {
  article: NewsArticle;
  onSelect: (a: NewsArticle) => void;
}) {
  const date = new Date(article.publishedAt);
  const timeStr = format(date, "dd MMM · HH:mm", { locale: fr });

  return (
    <button className="news-card" onClick={() => onSelect(article)}>
      <div className="card-header">
        <div className="source-badge">{article.sourceIcon}</div>
        <div className="card-header-text">
          <div className="source-name">{article.source}</div>
          <div className="card-time">{timeStr}</div>
        </div>
      </div>
      <div className="card-headline">{article.headline}</div>
      <div className="card-footer">
        <span className="read-more">Voir le résumé →</span>
      </div>
    </button>
  );
}

/* --- Page détail article --- */
function ArticleDetail({
  article,
  onBack,
}: {
  article: NewsArticle;
  onBack: () => void;
}) {
  const date = new Date(article.publishedAt);
  const timeStr = format(date, "EEEE dd MMMM · HH:mm", { locale: fr });

  return (
    <div className="detail">
      <button className="detail-back" onClick={onBack}>
        ← Retour
      </button>

      <div className="detail-source">
        <div className="source-badge">{article.sourceIcon}</div>
        <div className="card-header-text">
          <div className="source-name">{article.source}</div>
          <div className="card-time">{timeStr}</div>
        </div>
      </div>

      <h1 className="detail-headline">{article.headline}</h1>

      <div className="facts">
        {article.who && article.who !== "—" && (
          <div className="fact-row">
            <span className="fact-label">QUI</span>
            <span className="fact-value">{article.who}</span>
          </div>
        )}
        {hasContent(article.what) && (
          <div className="fact-row">
            <span className="fact-label">QUOI</span>
            <ul className="fact-list">
              {article.what.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {hasContent(article.why) && (
          <div className="fact-row">
            <span className="fact-label">POURQUOI</span>
            <ul className="fact-list">
              {article.why.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <a
        className="detail-link"
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
      >
        Voir l'article original →
      </a>
    </div>
  );
}

/* --- Helpers --- */
function hasContent(arr: string[]): boolean {
  return arr.some((s) => s && s.trim() && s.trim() !== "—");
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function enrichArticles(
  raw: RawArticle[],
  summaries: Map<string, ArticleSummary>
): NewsArticle[] {
  const enriched: NewsArticle[] = raw.map((a) => {
    const s = summaries.get(a.id);
    return {
      id: a.id,
      title: a.title,
      headline: s?.headline || a.title,
      who: s?.who || "—",
      what: s?.what ?? [a.description || "—"],
      why: s?.why ?? ["—"],
      topic: s?.topic || "autre",
      importance: s?.importance ?? 5,
      source: a.source,
      sourceIcon: a.sourceIcon,
      category: a.category,
      publishedAt: a.publishedAt,
      link: a.link,
    };
  });

  // Top N par (catégorie × jour), tri par importance puis date
  const groups = new Map<string, NewsArticle[]>();
  for (const article of enriched) {
    const key = `${article.category}::${dayKey(article.publishedAt)}`;
    const list = groups.get(key) ?? [];
    list.push(article);
    groups.set(key, list);
  }

  const top: NewsArticle[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    top.push(...list.slice(0, PER_DAY_PER_CATEGORY));
  }

  return top.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

/* --- App --- */
export default function App() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [category, setCategory] = useState<Category>("france");
  const [tab, setTab] = useState<Tab>("jour");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Récupération des flux RSS...");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const [diagnostic, setDiagnostic] = useState("");

  const loadNews = useCallback(async () => {
    try {
      setStatus("Récupération des flux RSS...");
      const raw = await fetchAllRSS();

      const fallbackSummaries = new Map<string, ArticleSummary>();
      setArticles(enrichArticles(raw, fallbackSummaries));
      setLoading(false);

      setStatus("Résumé des articles en cours...");
      const summaries = await summarizeArticles(raw);
      setArticles(enrichArticles(raw, summaries));
      setUpdatedAt(Date.now());
      setStatus("");
      setDiagnostic(
        `clé: ${getApiKeyState()} · ${getLastDiagnostic() || "rien à signaler"}`
      );
    } catch (e) {
      console.error("Erreur:", e);
      setStatus("Erreur de chargement");
      setLoading(false);
      setDiagnostic(`exception: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  useEffect(() => {
    loadNews();
    const interval = setInterval(loadNews, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadNews]);

  const filtered = articles.filter((a) => {
    const date = new Date(a.publishedAt);
    const matchCategory = a.category === category;
    const matchTime =
      tab === "jour"
        ? isToday(date)
        : isThisWeek(date, { weekStartsOn: 1 });
    return matchCategory && matchTime;
  });

  // Vue détail
  if (selected) {
    return (
      <ArticleDetail
        article={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  // Vue liste
  return (
    <>
      <div className="header">
        <h1>Actu Express</h1>
        <p>L'essentiel de l'info, sans le superflu</p>
      </div>

      <div className="filters">
        <div className="filter-row">
          <button
            className={`pill ${category === "france" ? "active" : ""}`}
            onClick={() => setCategory("france")}
          >
            France & Europe
          </button>
          <button
            className={`pill ${category === "monde" ? "active" : ""}`}
            onClick={() => setCategory("monde")}
          >
            Monde
          </button>
        </div>
        <div className="filter-row">
          <button
            className={`pill ${tab === "jour" ? "active" : ""}`}
            onClick={() => setTab("jour")}
          >
            Aujourd'hui
          </button>
          <button
            className={`pill ${tab === "semaine" ? "active" : ""}`}
            onClick={() => setTab("semaine")}
          >
            Cette semaine
          </button>
        </div>
      </div>

      {(status || updatedAt) && (
        <div className="updated-at">
          {status ||
            `Mis à jour ${format(new Date(updatedAt!), "HH:mm", { locale: fr })}`}
        </div>
      )}

      {diagnostic && (
        <div className="diagnostic">{diagnostic}</div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <p>Chargement des actualités...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📰</div>
          <h2>Aucune actualité</h2>
          <p>
            {tab === "jour"
              ? "Pas encore d'articles aujourd'hui."
              : "Aucun article cette semaine pour cette catégorie."}
          </p>
        </div>
      ) : (
        <div className="news-list">
          {filtered.map((article) => (
            <NewsCard
              key={article.id}
              article={article}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}
    </>
  );
}
