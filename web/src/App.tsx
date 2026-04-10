import { useEffect, useState, useCallback } from "react";
import { format, isToday, isThisWeek } from "date-fns";
import { fr } from "date-fns/locale";
import "./App.css";

interface NewsArticle {
  id: string;
  title: string;
  headline: string;
  who: string;
  what: string;
  why: string;
  source: string;
  sourceIcon: string;
  category: "france" | "monde";
  publishedAt: string;
  link: string;
}

type Category = "france" | "monde";
type Tab = "jour" | "semaine";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function NewsCard({ article }: { article: NewsArticle }) {
  const date = new Date(article.publishedAt);
  const timeStr = format(date, "dd MMM · HH:mm", { locale: fr });

  return (
    <a
      className="news-card"
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="card-header">
        <div className="source-badge">{article.sourceIcon}</div>
        <div className="card-header-text">
          <div className="source-name">{article.source}</div>
          <div className="card-time">{timeStr}</div>
        </div>
      </div>

      <div className="card-headline">{article.headline}</div>

      <div className="facts">
        {article.who && article.who !== "—" && (
          <div className="fact-row">
            <span className="fact-label">QUI</span>
            <span className="fact-value">{article.who}</span>
          </div>
        )}
        {article.what && article.what !== "—" && (
          <div className="fact-row">
            <span className="fact-label">QUOI</span>
            <span className="fact-value">{article.what}</span>
          </div>
        )}
        {article.why && article.why !== "—" && (
          <div className="fact-row">
            <span className="fact-label">POURQUOI</span>
            <span className="fact-value">{article.why}</span>
          </div>
        )}
      </div>

      <div className="card-footer">
        <span className="read-more">Lire l'article complet →</span>
      </div>
    </a>
  );
}

export default function App() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [category, setCategory] = useState<Category>("france");
  const [tab, setTab] = useState<Tab>("jour");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const loadNews = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/news`);
      const data = await res.json();
      setArticles(data.articles);
      setUpdatedAt(data.updatedAt);
    } catch (e) {
      console.error("Erreur API:", e);
    } finally {
      setLoading(false);
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
            France
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

      {updatedAt && (
        <div className="updated-at">
          Mis à jour {format(new Date(updatedAt), "HH:mm", { locale: fr })}
        </div>
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
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </>
  );
}
