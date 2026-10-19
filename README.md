# HookFlow

**Reliable webhook delivery, retries, and recovery — with an operations dashboard.**

HookFlow is a locally runnable webhook delivery platform built on an open-source delivery engine. It accepts application events through an Express API, queues matching webhook deliveries in Redis/BullMQ, and dispatches them through a background worker. PostgreSQL stores events and delivery attempts for the React dashboard.

This version adds a redesigned HookFlow dashboard, a deterministic transient-failure receiver for testing recovery, an automated end-to-end recovery test, and a local development proxy fix. See [Contributions and attribution](#contributions-and-attribution) for a precise breakdown.

## Architecture

```text
                         +--------------------+
                         | React/Vite console |
                         +---------+----------+
                                   | /api/v1
                                   v
                         +--------------------+
                         | Express API        |
                         | Events + webhooks  |
                         +----+-----------+---+
                              |           |
                    persists  |           | enqueues
                              v           v
                      +------------+  +-----------------+
                      | PostgreSQL |  | Redis / BullMQ  |
                      | via Prisma |  | delivery queue  |
                      +------------+  +--------+--------+
                                               |
                                               v
                                     +-------------------+
                                     | Background worker |
                                     +---------+---------+
                                               |
                                HTTP POST + HMAC signature
                                               |
                                               v
                                     +-------------------+
                                     | Webhook receiver  |
                                     | 200 / 500 / 503   |
                                     +-------------------+

Failed delivery -> delayed retry (exponential backoff)
Retries exhausted -> Dead Letter Queue (DLQ)
```

## Features

**Features provided by the underlying delivery engine**

- Webhook subscription management, event-type filtering and event fan-out.
- Asynchronous delivery with Redis, BullMQ and background workers.
- HMAC-SHA256 signed HTTP deliveries, API-key authentication and idempotency support.
- Bounded retries with exponential backoff and a Dead Letter Queue for exhausted deliveries.
- PostgreSQL-backed delivery history, failure visibility and analytics.
- Dashboard pages for overview, webhooks, firing events and the DLQ.

**Enhancements in this HookFlow version**

- Rebranded and redesigned dashboard pages and navigation.
- Vite development proxy (`/api` to local Express backend) so local registration and dashboard API requests work.
- `POST /webhook-flaky`: a reproducible receiver that returns HTTP **503** on attempts 1 and 2, then **200** on attempt 3.
- Node.js built-in test runner integration test (`tests/recovery.test.cjs`) covering real event creation, queued delivery and eventual HTTP 200 recovery through the running worker.
- Removed the original hardcoded demo-login shortcut.

## Technology

| Area | Stack |
| --- | --- |
| API | Node.js, TypeScript, Express |
| Job processing | Redis 7, BullMQ |
| Database | PostgreSQL 15, Prisma |
| Dashboard | React, TypeScript, Vite, Tailwind CSS |
| Local infrastructure | Docker Desktop, Docker Compose |
| Tests | Node.js built-in test runner (`node --test`) |

## Run locally (Windows 11 / PowerShell)

Tested with Node.js **22.14.0**, npm **10.9.2**, Docker Desktop using WSL 2, PostgreSQL 15 and Redis 7.

### 1. Clone and install

```powershell
git clone https://github.com/Saumyathecoder/HookFlow.git
cd HookFlow
npm ci
cd dashboard
npm install
cd ..
```

> The dashboard dependency lockfile was synchronized during development; if `npm ci` works for the dashboard on your checkout, you may use it instead of `npm install`.

### 2. Start PostgreSQL and Redis

Start Docker Desktop first, then run:

```powershell
docker compose up -d postgres redis
docker compose ps
```

Both containers should show healthy. Their local host ports are **5434** (PostgreSQL) and **6380** (Redis).

### 3. Configure the backend

```powershell
Copy-Item .env.example .env
```

Set the following development values in the **untracked** `.env` file:

```dotenv
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://webhookuser:webhookpass@localhost:5434/webhookdb"
REDIS_URL="redis://localhost:6380"
JWT_SECRET="replace-with-a-long-random-local-secret"
API_KEY_PREFIX="whe"
```

These credentials are intended for local development only. **Do not commit `.env`, your API key, or any deployment secrets.** Use appropriate credentials and secret management before exposing the application publicly.

Initialize Prisma:

```powershell
npx prisma generate
npx prisma db push
```

### 4. Start the services

Keep each command running in its own PowerShell terminal, from the repository root:

```powershell
# Terminal 1 — API on http://localhost:3000
npm run dev
```

```powershell
# Terminal 2 — background delivery worker
npm run dev:worker
```

```powershell
# Terminal 3 — local mock receiver on http://localhost:4000
npm run dev:mock
```

```powershell
# Terminal 4 — dashboard on http://localhost:5173
cd dashboard
npm run dev
```

Open **http://localhost:5173** and create a local account to obtain an API key. Keep the key private. Check **http://localhost:3000/api/v1/health** for backend readiness.

## Reproduce the delivery scenarios

In the dashboard, register a webhook for the specified event type and then use **Fire Event** with matching JSON payload.

| Scenario | Receiver URL | Event type | Expected behavior |
| --- | --- | --- | --- |
| Normal delivery | `http://localhost:4000/webhook` | `payment.success` | HTTP 200 on first attempt |
| Persistent failure | `http://localhost:4000/webhook-fail` | `payment.failed` | HTTP 500, retries, then DLQ after 5 attempts |
| Transient failure | `http://localhost:4000/webhook-flaky` | `order.created` | HTTP 503 twice, then HTTP 200 on attempt 3 |

Inspect worker logs, **Webhooks → History**, and the **Dead Letter Queue** dashboard page to follow the results. The mock receiver deliberately fails; it is **not** a production endpoint.

### Automated recovery test

Start the API, worker, mock receiver, PostgreSQL and Redis first. Create a local client/API key and register an **active** `order.created` webhook pointing to `http://localhost:4000/webhook-flaky`.

In a **new PowerShell terminal** at the repository root:

```powershell
$env:HOOKFLOW_API_KEY = Read-Host "Enter your local API key"
node --test tests/recovery.test.cjs
```

The test creates a real event through the API and polls persisted delivery status until the flaky receiver succeeds or the test times out. It does **not** mock the queue or worker.

**Observed locally (19 Oct 2026):**

- Successful `payment.success` webhook: HTTP **200** on attempt **1**, with **123 ms** observed response time.
- Persistent `payment.failed` webhook: **5** HTTP 500 attempts, followed by a DLQ entry.
- Transient `order.created` webhook: HTTP **503** on attempts **1–2**, HTTP **200** on attempt **3**.
- Automated recovery integration test: **1 passed, 0 failed** (approximately **4 s** for that run).
- Redesigned dashboard: TypeScript and Vite production build passed (`npm run build`).

These are individual local verification results, **not** load-test or throughput benchmarks.

## Key API routes

Base URL: `http://localhost:3000/api/v1`. Protected endpoints use the `x-api-key` request header.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check API health |
| `POST` | `/clients/register` | Register a client and get an API key |
| `POST` | `/webhooks` | Register a webhook URL |
| `GET` | `/webhooks` | List webhooks |
| `POST` | `/events` | Fire an event and queue deliveries |
| `GET` | `/events/:id/status` | Inspect delivery status |
| `GET` | `/webhooks/:id/history` | Inspect webhook delivery history |
| `GET` | `/dlq` | List dead-lettered deliveries |
| `POST` | `/dlq/:id/retry` | Request manual retry |
| `GET` | `/analytics/overview` | Read overview metrics |

**Note:** The manual DLQ retry route exists in the underlying code but was not part of this version's verified scenarios.

## Project layout

```text
src/                   Express API, queue integration, delivery worker
src/mock-server/       Success, permanent-failure and flaky receivers
prisma/                Database schema
dashboard/             React operations console
tests/recovery.test.cjs End-to-end transient-failure recovery test
docker-compose.yml     Local Redis and PostgreSQL
LICENSE                Original MIT license and copyright notice
```

## Screenshots

## Dashboard Screenshots

### 1. Delivery Overview
Monitor webhook activity, delivery success rates, and system performance.

![HookFlow Overview Dashboard](docs/screenshots/overview.png)

### 2. Webhook Management
Manage registered webhook endpoints and monitor their delivery configurations.

![HookFlow Webhook Management](docs/screenshots/webhooks.png)

### 3. Dead Letter Queue
Inspect failed deliveries after retry exhaustion and access manual recovery controls.

![HookFlow Dead Letter Queue](docs/screenshots/dead-letter-queue.png)

## Contributions and attribution

This repository is **an adaptation of** [Vaibhav Bhardwaj's webhook-delivery-engine](https://github.com/VaibhavXBhardwaj/webhook-delivery-engine), which supplies the original API, database models, queue/worker, retry and DLQ functionality. It is **not** presented as a from-scratch implementation of that infrastructure.

Changes made for **HookFlow** include the visual redesign/rebranding, frontend development proxy, custom flaky receiver, automated end-to-end recovery test, local integration verification and removal of a hardcoded demo-login shortcut.

The original [MIT license and copyright notice](LICENSE) are preserved. Project-specific changes are documented above; the original author's contributions remain attributed.

## Security and deployment notes

- Local development is verified; this repository is **not claimed to be production-deployed or security-audited**.
- Keep `.env` and API keys private. Do not use example credentials on a public server.
- The dependency tree produced npm audit warnings during local setup; review and remediate them before production deployment.
- Use TLS, production secret management, controlled access and appropriate network exposure before hosting publicly.

---

**Maintained as HookFlow by [Saumyathecoder](https://github.com/Saumyathecoder)** · Based on the original open-source project credited above.
