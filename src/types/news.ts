export interface NewsArticle {
  id: string;
  title: string;
  headline: string;
  who: string;
  what: string;
  why: string;
  source: string;
  sourceIcon: string;
  category: "france" | "monde";
  publishedAt: Date;
  link: string;
}

export type TabFilter = "jour" | "semaine";
export type CategoryFilter = "france" | "monde";
