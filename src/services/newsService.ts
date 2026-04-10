import { NewsArticle, CategoryFilter, TabFilter } from "../types/news";
import { isToday, isThisWeek } from "date-fns";

// En dev : localhost. En prod : remplacer par l'URL du serveur déployé.
const API_URL = __DEV__
  ? "http://10.9.19.254:3001"
  : "https://your-server.com";

export async function fetchAllNews(): Promise<NewsArticle[]> {
  try {
    const response = await fetch(`${API_URL}/api/news`);
    const data = await response.json();

    return data.articles.map((a: any) => ({
      ...a,
      publishedAt: new Date(a.publishedAt),
    }));
  } catch (error) {
    console.error("Erreur API:", error);
    return [];
  }
}

export function filterNews(
  articles: NewsArticle[],
  category: CategoryFilter,
  tab: TabFilter
): NewsArticle[] {
  return articles.filter((article) => {
    const matchesCategory = article.category === category;
    const matchesTime =
      tab === "jour"
        ? isToday(article.publishedAt)
        : isThisWeek(article.publishedAt, { weekStartsOn: 1 });

    return matchesCategory && matchesTime;
  });
}
