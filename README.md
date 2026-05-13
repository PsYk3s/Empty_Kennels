# PB App - Offline-First Trade Show Lead Capture PWA

Production-ready monorepo containing:
- **web/**: React + Vite Progressive Web App for Android tablets.
- **server/**: Node.js + Express API.
- **database/**: PostgreSQL migrations and seed scripts.

## Features
- Offline-first lead capture using IndexedDB (Dexie)
- Auto sync on startup/reconnect/create and every 10 minutes
- Exponential backoff sync retry
- Idempotent lead sync via UUID
- Supplier selection with optional CC email notifications
- Future-ready Brevo integration behind feature flag
- Catalogue viewer with local cache metadata
- Multi-event support
- Dockerized local/prod bootstrap

## Project Structure

```
.
├── web/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── storage/
│       ├── sync/
│       ├── api/
│       ├── utils/
│       ├── models/
│       ├── services/
│       ├── styles/
│       └── config/
├── server/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── middleware/
│   ├── database/
│   ├── models/
│   ├── integrations/
│   ├── utils/
│   └── config/
├── database/
│   ├── migrations/
│   └── seeds/
├── docker-compose.yml
└── Dockerfile
```

## Quick Start

1. Copy environment files.
   ```bash
   cp .env.example .env
   cp server/.env.example server/.env
   cp web/.env.example web/.env
   ```
2. Install dependencies.
   ```bash
   npm install
   npm install -w server
   npm install -w web
   ```
3. Start PostgreSQL and API using Docker.
   ```bash
   docker compose up -d db server
   ```
4. Run migrations + seed.
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
5. Start web app.
   ```bash
   npm run dev:web
   ```

## Sync Behavior
- Sync runs on startup, online event, lead create and 10-minute interval.
- Only `pending`/`failed` leads are batched.
- Retries use exponential backoff with capped attempts.

## Email + Brevo
- Email sends once per lead based on `email_logs` unique lead UUID.
- Brevo integration is disabled by default: `BREVO_ENABLED=false`.
- Enabling Brevo requires `BREVO_API_KEY` and `BREVO_LIST_ID`.

## Deployment

### Docker
```bash
docker compose up --build
```

### Production Build
```bash
npm run build
```

## Notes
- Add branding assets and replace sample catalogues before launch.
- Configure SMTP and admin email for production notifications.

## Install on Android Tablet (PWA)

1. Deploy the app over **HTTPS** (required for service worker/PWA install on Android).
2. Open the deployed URL in **Chrome on the tablet**.
3. Tap the browser menu and choose **Install app** (or **Add to Home screen**).
4. Launch from home screen; it runs in standalone full-screen mode.

### Local Network Test (before production)
- Run web with host binding:
  ```bash
  npm run dev:web -- --host 0.0.0.0 --port 5173
  ```
- From tablet on same Wi-Fi, open:
  `http://<your-laptop-ip>:5173`
- Note: this works for UI testing, but full PWA install/update reliability is best on HTTPS.

## How Updates Work

Short answer: **yes, it will update when you deploy new code**, with PWA rules:

- The app shell/assets are cached by the service worker.
- `vite-plugin-pwa` is configured with `registerType: 'autoUpdate'`, so it checks for new versions in the background.
- Usually users get the updated app on next launch/reload after a deployment.

### Recommended Release Flow
1. Push code to repo.
2. Build/deploy updated `web` and `server`.
3. Ask users to close/reopen the app once after release (or refresh if opened in browser) to pick up the newest service worker.

### Important Operational Notes
- Existing offline data in IndexedDB remains on device across app updates.
- If you ship IndexedDB schema changes, bump Dexie DB version and include migration logic.
- If API contracts change, maintain backward compatibility for at least one app version to avoid sync failures during rollout.
## Vercel Deployment Fix ("Cannot GET /")

If Vercel shows **Cannot GET /**, it is usually deploying the Node API entrypoint instead of the built SPA assets.

This repo now includes `vercel.json` to force Vercel to:
- build the **web** workspace,
- publish `web/dist`, and
- rewrite all SPA routes to `index.html`.

### Steps in Vercel Project Settings
1. Framework Preset: **Other**
2. Root Directory: repository root (default)
3. Build Command: auto from `vercel.json`
4. Output Directory: auto from `vercel.json`
5. Redeploy after pushing changes.

For backend APIs, deploy `server`/`api` separately (e.g., Railway/Render/Fly) and point `VITE_API_BASE_URL` to that API URL.
