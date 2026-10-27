# Actu Express — avancement

## 2026-10-27 — l'app n'affichait plus rien

**Cause** : rss2json.com renvoie une vérification Cloudflare (403) à la place du JSON, et ce pour les 6 flux.
Les erreurs étaient avalées en silence, d'où « Aucune actualité ».
Deuxième bug trouvé au passage : `parseDate` cassait les dates des flux (« Tue, 27 Oct … »), donc chaque article
prenait l'heure du chargement.

**Correctif (codé et testé en local, pas encore déployé)** :
- `worker/` : Worker Cloudflare `actu-express-api` qui relaie 6 flux autorisés (`GET /rss?source=…`, cache de 10 min)
  et appelle Claude (`POST /summarize`, prompt et clé côté Worker, seulement depuis rom74274.github.io et localhost:5173).
- `web/` : lecture du XML dans le navigateur (DOMParser), dates corrigées, appel au Worker au lieu
  d'api.anthropic.com, message « Sources injoignables » ou « Indisponible : … ».
- `deploy.yml` : la clé Anthropic n'est plus intégrée au build.

**Reste à faire (Romain)** : déployer le Worker, mettre son secret, pousser sur main, révoquer l'ancienne clé.

**Idée en attente** : passer à `claude-haiku-5-5` (0,10 $ / 0,50 $ par million de tokens, contre 1 $ / 5 $ pour Haiku 4.5).
