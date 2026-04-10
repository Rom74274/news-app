export interface RSSSource {
  name: string;
  url: string;
  icon: string;
  category: "france" | "monde";
}

export const NEWS_SOURCES: RSSSource[] = [
  // --- Sources françaises fiables ---
  {
    name: "Le Monde",
    url: "https://www.lemonde.fr/rss/une.xml",
    icon: "LM",
    category: "france",
  },
  {
    name: "France Info",
    url: "https://www.francetvinfo.fr/titres.rss",
    icon: "FI",
    category: "france",
  },
  {
    name: "Le Figaro",
    url: "https://www.lefigaro.fr/rss/figaro_actualites.xml",
    icon: "LF",
    category: "france",
  },
  {
    name: "Libération",
    url: "https://www.liberation.fr/arc/outboundfeeds/rss-all/collection/accueil-702702/?outputType=xml",
    icon: "Lib",
    category: "france",
  },
  {
    name: "France 24 FR",
    url: "https://www.france24.com/fr/rss",
    icon: "F24",
    category: "france",
  },
  // --- Sources internationales fiables ---
  {
    name: "BBC News",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    icon: "BBC",
    category: "monde",
  },
  {
    name: "Reuters",
    url: "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best",
    icon: "Reu",
    category: "monde",
  },
  {
    name: "France 24 EN",
    url: "https://www.france24.com/en/rss",
    icon: "F24",
    category: "monde",
  },
  {
    name: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    icon: "AJ",
    category: "monde",
  },
  {
    name: "RFI",
    url: "https://www.rfi.fr/fr/rss",
    icon: "RFI",
    category: "monde",
  },
];
