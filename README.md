# regee-onair

Affichage ON-AIR avec horloges multi-fuseaux + API simple pour pilotage (ATEM, macro HTTP, curl).

## Vercel (deploiement direct)

Le projet racine est pret pour Vercel:

- Front: `index.html`
- API serverless: `api/state.js`, `api/on.js`, `api/off.js`

### 1) Variables d'environnement

Configurer dans Vercel (Project Settings -> Environment Variables):

- `ONAIR_TOKEN`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Le fichier `.env.example` donne le format attendu.

### 2) Endpoints

- `GET /api/state` (public)
- `GET /api/on?token=...` ou `POST /api/on` avec `Authorization: Bearer ...`
- `GET /api/off?token=...` ou `POST /api/off` avec `Authorization: Bearer ...`

Exemples:

```bash
curl "https://votre-domaine.vercel.app/api/on?token=VOTRE_TOKEN"
curl "https://votre-domaine.vercel.app/api/off?token=VOTRE_TOKEN"
curl "https://votre-domaine.vercel.app/api/state"
```

## Correctif freeze applique

Correctifs appliques sur les pages front (`index.html` et `onair-regie/public/index.html`):

- cache des `Intl.DateTimeFormat` (moins de charge CPU)
- polling non-concurrent via `setTimeout` recursif (evite les empilements)
- timeout reseau avec `AbortController`
- cadence de polling reduite a 3s
- fallback automatique `"/api/state" -> "/onair.json"`