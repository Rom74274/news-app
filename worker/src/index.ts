import Anthropic from "@anthropic-ai/sdk";

interface Env {
  ANTHROPIC_API_KEY: string;
}

// Seuls ces flux sont relayés : le Worker n'est pas un proxy ouvert.
const FEEDS: Record<string, string> = {
  lemonde: "https://www.lemonde.fr/rss/une.xml",
  lefigaro: "https://www.lefigaro.fr/rss/figaro_actualites.xml",
  euronews: "https://fr.euronews.com/rss",
  bbc: "https://feeds.bbci.co.uk/news/world/rss.xml",
  aljazeera: "https://www.aljazeera.com/xml/rss/all.xml",
  rfi: "https://www.rfi.fr/fr/rss",
};

const ALLOWED_ORIGINS = ["https://rom74274.github.io", "http://localhost:5173"];
const FEED_CACHE_SECONDS = 600;

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

async function handleRss(url: URL, cors: Record<string, string>): Promise<Response> {
  const feedUrl = FEEDS[url.searchParams.get("source") ?? ""];
  if (!feedUrl) return json({ error: "source inconnue" }, 400, cors);

  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "ActuExpress/1.0 (+https://rom74274.github.io/news-app/)" },
    cf: { cacheTtl: FEED_CACHE_SECONDS, cacheEverything: true },
  });
  if (!res.ok) return json({ error: `flux HTTP ${res.status}` }, 502, cors);

  return new Response(await res.text(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, max-age=${FEED_CACHE_SECONDS}`,
      ...cors,
    },
  });
}

function buildPrompt(source: string, title: string, description: string): string {
  return `Tu es rédacteur en chef. Analyse cet article et renvoie UN OBJET JSON.

Article :
Source : ${source}
Titre : ${title}
Contenu : ${description}

Champs à remplir :
- "headline" : string, 1-2 phrases percutantes qui résument l'actu
- "who" : string, 2-3 phrases sur les acteurs (personnes, organisations, pays)
- "what" : array de 3-4 strings, chacun = 1 fait concret, chiffre ou décision (≈ 1 phrase courte par bullet)
- "why" : array de 2-3 strings, chacun = 1 enjeu ou conséquence (≈ 1 phrase courte par bullet)
- "topic" : un seul mot parmi "géopolitique" | "économie" | "société" | "tech" | "culture" | "sport" | "faits divers" | "autre"
- "importance" : entier 1-10
   * 9-10 = événement majeur (guerre, krach, élection présidentielle, crise géopolitique)
   * 7-8 = décision politique/économique forte (banque centrale, traité, manifestation nationale)
   * 5-6 = actualité standard (nomination, étude, événement régional)
   * 3-4 = faits divers, célébrités, sport courant
   * 1-2 = trivial

Règles :
- Si l'article est en anglais, réponds en français
- Sois factuel et précis
- Pas de puces ("•", "-") au début des bullets : juste le texte
- Réponds UNIQUEMENT avec l'objet JSON, aucun texte avant/après.

Format :
{
  "headline": "...",
  "who": "...",
  "what": ["fait 1", "fait 2", "fait 3"],
  "why": ["enjeu 1", "enjeu 2"],
  "topic": "économie",
  "importance": 7
}`;
}

function field(body: Record<string, unknown>, key: string, max: number): string {
  const v = body[key];
  return typeof v === "string" ? v.slice(0, max) : "";
}

async function handleSummarize(
  request: Request,
  env: Env,
  cors: Record<string, string>
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "JSON invalide" }, 400, cors);
  }
  const title = field(body, "title", 500);
  if (!title) return json({ error: "titre manquant" }, 400, cors);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: buildPrompt(
            field(body, "source", 100),
            title,
            field(body, "description", 2000)
          ),
        },
      ],
    });
    const text = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    return json({ text }, 200, cors);
  } catch (error) {
    const status = error instanceof Anthropic.APIError ? error.status ?? 502 : 502;
    console.warn("[Claude]", status, error);
    return json({ error: `Claude HTTP ${status}` }, 502, cors);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET" && url.pathname === "/rss") return handleRss(url, cors);
    if (request.method === "POST" && url.pathname === "/summarize") {
      if (!cors["Access-Control-Allow-Origin"]) return json({ error: "origine refusée" }, 403, cors);
      return handleSummarize(request, env, cors);
    }
    return json({ error: "introuvable" }, 404, cors);
  },
};
