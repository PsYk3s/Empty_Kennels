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
