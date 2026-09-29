# ANTIGRAVITY MASTER PROMPT: BUILD EDGEDEPLOY

You are a senior full-stack engineer, DevOps engineer and security-minded technical mentor. Build **EdgeDeploy** as a **real, runnable, tested application**, not a UI prototype.

> **EdgeDeploy: A Distributed Edge Hosting Platform with CDN, Automatic Deployment and Intelligent Rate Limiting.**
> An academic (GSFC University, AWT course) mini Vercel/Netlify + Cloudflare. It teaches CI/CD, webhooks, CDN caching, load balancing, rate limiting, REST APIs and relational modelling. It is **not** a production clone.

The SRS and Project Explainer PDFs are in the workspace. **The SRS is the source of truth; the Explainer is secondary.** If they conflict, follow the SRS and record the decision in `docs/DECISIONS.md`. Do not silently invent or drop requirements.

---

## 0. NON-NEGOTIABLE RULES

1. **Real functionality only.** "Cache HIT" must come from a real cache lookup. "Round Robin" must really alternate between edge processes. "Deployment SUCCESS" must come from a real clone + install + build. No fake labels, hardcoded chart data, or mock responses in non-test code.
2. **Inspect before modifying.** Check for an existing repo, package versions, env and DB config, routes, frontend structure and tests. Reuse working code. If existing code conflicts with the SRS, explain it and change it carefully.
3. **Never hide errors.** Read the error, find the root cause, fix it, re-run, verify. Never suppress errors, delete requirements because they are hard, or replace architecture with UI.
4. **Work incrementally** in the phases of Section 14. Do not start a phase while the previous one is broken. Each phase ends with: Implement → Run → Test → Fix → short report of what was verified.
5. **Keep it simple and viva-explainable.** Prefer simple, modular, testable and demonstrable code over clever infrastructure.
6. **If something cannot be done fully within SRS constraints**, build the closest academically valid simulation and document the limitation in `docs/LIMITATIONS.md`.

## 1. HARD SCOPE LIMITS (from SRS §2.4, §7.2)

Do **NOT** introduce: Docker, Docker Swarm, Kubernetes, serverless or edge functions, real multi-region or Anycast, auto-scaling, distributed databases, a WAF or DDoS protection, automated SSL/DNS, dynamic app hosting (Node/PHP/Python), databases inside deployed projects, or an ORM.
Hosted sites are **static HTML/CSS/JS only**. Edge nodes are **separate simulated Node.js processes** on one machine, and their number is configured manually. Every service runs as a plain process.
Build sandboxing is **not** production-grade. Never claim otherwise. Document it as a limitation.

## 2. MANDATORY STACK

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + React + TypeScript, Recharts for charts |
| Backend | Node.js + **Fastify** + TypeScript (REST) |
| Database | **MySQL 8, raw SQL via `mysql2` with parameterized queries, NO ORM** |
| Git | **simple-git** (clone/checkout/listRemote; no hand-typed git shell commands) |
| Auth | JWT (`jsonwebtoken` or `@fastify/jwt`) + `bcrypt`/`argon2` password hashing |
| Storage | Local filesystem (MinIO optional, not required) |
| Compression | Node built-in `zlib` (gzip/brotli) |
| Validation | zod or Fastify JSON-schema |
| Tests | Vitest (or Jest) + supertest/`fastify.inject` |
| Process runner | npm scripts + `concurrently`/`tsx`. No containers. |

Do not swap to Express, PostgreSQL or Prisma.

## 3. PROCESSES AND PORTS (monorepo, npm workspaces)

```
edgedeploy/
├── frontend/        Next.js dashboards                        :3000
├── backend/         Control plane: REST API, webhook,
│                    deployment + build services, health checker :3001
├── origin/          Origin Server (serves active site files)  :4000
├── gateway/         Serving pipeline entry: Rate Limiter →
│                    Load Balancer → proxy to edge            :8080
├── edge-node/       One codebase, N processes (edge-1..N)     :4101, 4102, 4103
├── shared/          DB pool, config loader, types, logger
├── database/        schema.sql, migrations/, seed.ts
├── storage/         origin/, edges/edge-N/, builds/  (gitignored)
├── scripts/         demo + verification scripts
├── tests/  docs/
```

`npm run dev` starts everything. Also provide `npm run backend`, `origin`, `gateway`, `frontend`, `edges` (starts all configured nodes) and `edge:1`, `edge:2`, `edge:3`. Edge count and ports come from `EDGE_NODE_PORTS` (e.g. `4101,4102,4103`) so adding a node is **config only** (NFR-SCA-01). Edge nodes are also rows in `EdgeNodes`.

Internal service-to-service calls (purge, health) use a shared `INTERNAL_API_TOKEN` header.

## 4. TWO PIPELINES (keep them visibly separate in code and docs)

**Deployment pipeline (Half 1):**
`GitHub push → Webhook Handler → Deployment Service → Build Service → publish to Origin → mark active → purge edge caches`

**Serving pipeline (Half 2):**
`Visitor → Rate Limiter → Load Balancer → Edge → cache HIT? return : Origin → store in edge cache → return`

The rate limiter runs **first**, before anything else (SRS 3.4). The Explainer's serving diagram omits it, but Part B places it first. Follow the SRS and log this in `DECISIONS.md`.

## 5. DATABASE (MySQL, raw SQL)

Deliver `database/schema.sql`, numbered migrations, a migration runner script, indexes, and a seed script. Use InnoDB, utf8mb4, FKs with sensible `ON DELETE` rules, unique constraints, `created_at`/`updated_at`, and ENUM/status columns. Keep the SQL in a readable **repository/query module per domain** (e.g. `backend/src/projects/projects.repo.ts`), with no SQL scattered in route handlers (NFR-MNT-02).

The SRS defines exactly these 12 tables. **Do not add more.** Put extra needs in columns:

- **Users**: id, email (unique), password_hash, role ENUM('DEVELOPER','ADMIN'), is_blocked, created_at
- **Projects**: id, user_id FK, name, slug (unique), build_command, output_directory, install_command, branch, active_deployment_id (nullable FK), created_at, updated_at
- **Repositories**: id, project_id FK (unique, 1:1), repo_url, owner, name, default_branch, webhook_id, webhook_secret, created_at
- **Deployments**: id, project_id FK, commit_sha, commit_message, branch, status ENUM('QUEUED','BUILDING','SUCCESS','FAILED','CANCELLED'), trigger ENUM('WEBHOOK','MANUAL','REDEPLOY'), started_at, finished_at, created_at. Index (project_id, created_at).
- **DeploymentLogs**: id, deployment_id FK, seq, level, stream ENUM('SYSTEM','STDOUT','STDERR'), message, created_at
- **Builds**: id, deployment_id FK (unique, 1:1), command, install_duration_ms, build_duration_ms, exit_code, status, error_summary
- **Files**: id, deployment_id FK, path, size_bytes, content_type, sha256 (ETag source). Unique (deployment_id, path).
- **EdgeNodes**: id, name, port, region, status ENUM('HEALTHY','UNHEALTHY','OFFLINE'), cache_capacity, last_heartbeat, created_at
- **CacheEntries**: id, edge_node_id FK, file_id FK, project_id, cache_key, size_bytes, ttl_seconds, created_at, expires_at, last_accessed_at, hit_count. Unique (edge_node_id, cache_key). This is the many-to-many table between Files and EdgeNodes.
- **RequestLogs**: id, ts, client_ip, project_id (nullable), domain, path, method, status_code, latency_ms, edge_node_id (nullable), cache_result ENUM('HIT','MISS','NONE'), bytes. Indexes on (project_id, ts) and (ts).
- **RateLimits**: id, client_ip, endpoint (nullable), tokens/counter state, window_start, request_count, is_blocked, blocked_until, block_reason, blocked_by ENUM('AUTO','ADMIN'), updated_at. Unique (client_ip, endpoint).
- **Domains**: id, project_id FK, hostname (unique, e.g. `my-site.localhost`), is_primary

Relationships must match SRS §5.2. Seed:
- one ADMIN, with the password read from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env, never hardcoded and never committed;
- one demo DEVELOPER with a dev-only password documented in the README;
- the configured EdgeNodes;
- a sample project, a sample successful deployment, and some sample RequestLogs, so the dashboards are not empty.

## 6. AUTH AND USERS (FR-AUTH-01..04)

- `POST /api/auth/signup` {email, password}. Validate email and password strength. Hash with bcrypt (cost ≥ 10) or argon2. Signup always creates DEVELOPER. Return 409 on a duplicate email.
- `POST /api/auth/login` returns a JWT with claims `userId`, `role`, `exp`. Blocked users get 403 with a clear message. Use a generic message for bad credentials.
- `GET /api/auth/me`.
- Middleware chain: `authenticate` (verify JWT, load user, reject if blocked) → `requireRole('ADMIN')`. Missing/invalid JWT → 401. Wrong role → 403.
- Ownership checks on every project/deployment/analytics route: a developer accessing another user's resource gets 404 (preferred) or 403.
- Admin: list users; block/unblock (`PATCH /api/admin/users/:id/block|unblock`). An admin cannot block themselves.
- JWT secret from env, never logged. The frontend keeps the token in memory + localStorage (documented trade-off) and sends `Authorization: Bearer`.

## 7. PROJECTS AND GITHUB (FR-PROJ-01..03)

- Project CRUD: `POST/GET /api/projects`, `GET/PATCH/DELETE /api/projects/:id`. Slug is derived from the name and unique. Settings: build_command (default `npm run build`), install_command (default `npm install`), output_directory (default `dist`), branch.
- `POST /api/projects/:id/repository` {repoUrl, githubToken?}:
  - Validate the URL strictly: `https://github.com/<owner>/<repo>(.git)?`, otherwise 422. (Allow `file://` local repos **only** when `ALLOW_LOCAL_REPOS=true`, for tests and offline demos.)
  - Read repo info via the GitHub REST API (default branch, existence).
  - Generate a random per-repo `webhook_secret`. Register the webhook (`POST /repos/:o/:r/hooks`, event `push`, content type JSON, URL `${PUBLIC_WEBHOOK_URL}/api/webhooks/github`). Store `webhook_id`.
  - The GitHub token is used **once**, is never stored or logged, and can come from the request body or an optional env fallback.
  - If webhook registration fails (for example localhost is not public), keep the repo linked, mark it "webhook not registered", show a clear UI warning, and keep **manual deploy** working.
  - Document how to expose the webhook locally (ngrok/smee/cloudflared) in `DEPLOYMENT.md`. Also provide `scripts/simulate-webhook.ts`, which sends a correctly signed push payload so the full pipeline is demonstrable without the internet.
- `GET /api/projects/:id/repository`. Deleting a project deletes its webhook (best effort), origin files and cached copies.
- A Domain row is created for each project (`<slug>.localhost`).

## 8. WEBHOOK AND DEPLOYMENT PIPELINE (FR-DEP-01..07)

**`POST /api/webhooks/github`** (unauthenticated by JWT, authenticated by signature):
1. Capture the **raw body** (Fastify raw-body plugin).
2. Identify the repo from the payload, find its stored `webhook_secret`, and verify `X-Hub-Signature-256` (HMAC-SHA256, `crypto.timingSafeEqual`). Invalid → 401. Do not leak why.
3. `ping` → 200. Only handle `push` on the project's configured branch, and ignore deleted-branch pushes.
4. Extract `after` (commit SHA), branch and head commit message. Find the project (404/ignore if none). Ignore blocked owners.
5. Create a Deployment `QUEUED`, respond 202 quickly, and enqueue the job.

Manual endpoints: `POST /api/projects/:id/deploy` (uses `simpleGit().listRemote` to resolve the branch head), `POST /api/projects/:id/redeploy` (re-runs the last commit), and `POST /api/deployments/:id/cancel` (optional).

**Job queue:** a simple in-process FIFO queue with concurrency limit `BUILD_CONCURRENCY` (default 2). No Redis. On backend restart, mark stale `BUILDING` deployments `FAILED` ("interrupted").

**State machine** (enforce in one function; illegal transitions throw):
`QUEUED → BUILDING → SUCCESS | FAILED` (optionally `CANCELLED`).

**Build Service steps** (each writes DeploymentLogs to the DB as it goes, so the UI can show progress live):
1. Create an isolated dir `storage/builds/deployment-<id>/`. Resolve it and assert it stays inside `BUILDS_ROOT` (path-traversal guard).
2. `simple-git` clone, then `checkout <exact commit sha>`. Verify the HEAD SHA equals the requested one.
3. Run the install command, then the build command. Use `child_process.spawn` with a parsed argv and **no shell interpolation of user data**, `cwd` = the build dir, and a minimal, scrubbed env (do **not** pass EdgeDeploy secrets, JWT secret, DB creds or GitHub tokens). Capture stdout and stderr line by line into DeploymentLogs.
4. Enforce a **timeout** (`BUILD_TIMEOUT_MS`, default 5 min) and kill the whole process tree on timeout. Cap the total log size (`MAX_LOG_BYTES`, then append "log truncated").
5. Record the Build row (command, durations, exit code, status, error summary).
6. Locate `output_directory`. Resolve it and verify it is inside the build dir. Reject symlinks that escape it. Fail clearly if it is missing or has no `index.html`.
7. Walk the output, compute sha256 and content type per file, and insert **Files** rows. Enforce a max file count and total size.
8. **Publish:** copy to `storage/origin/<projectId>/<deploymentId>/` (write to a temp dir, then atomic rename). Then, in **one SQL transaction**, set `Deployments.status='SUCCESS'` and `Projects.active_deployment_id = <id>`.
9. **Invalidate caches:** call `POST /internal/purge {projectId}` on every non-offline edge, log per-edge results, and delete the matching CacheEntries. A purge failure on a down edge must not fail the deployment. That edge must purge on rejoin (see §10).
10. Clean up the build dir in a `finally` (keep it on failure only if `KEEP_FAILED_BUILDS=true`). Prune old origin deployment dirs beyond `KEEP_DEPLOYMENTS` (default 5) but never the active one.

**Critical invariant:** a FAILED or in-progress deployment **never** changes `active_deployment_id`. The old version keeps serving until a new build succeeds. Write a test that proves this.

**Endpoints:** `GET /api/projects/:id/deployments`, `GET /api/deployments/:id`, `GET /api/deployments/:id/logs?afterSeq=` (supports polling). Logs are persisted so failure reasons stay reviewable forever (NFR-REL-03).

Structured server logs, e.g. `[INFO] GitHub webhook received`, `Deployment created`, `Repository cloned`, `Build started/completed`, `Deployment published`, `Cache invalidation started/completed`.

## 9. ORIGIN SERVER (`origin/`, :4000)

`GET /sites/:projectId/*path` resolves the project's **active deployment** (DB lookup with a short in-memory cache invalidated on publish), serves the file from `storage/origin/...`, `/` → `index.html`, and returns `ETag` (Files.sha256), `Content-Type`, `X-Deployment-Id`, and `Cache-Control`. Return 404 for missing files and 400 for traversal (`..`, encoded variants, absolute paths). Never serve outside the deployment dir. Support `If-None-Match` → 304. It exposes `GET /health`. Only internal callers (edges) need to reach it, so protect it with the internal token.

## 10. EDGE NODES (`edge-node/`, one process per node)

Config from env/args: `NODE_ID`, `PORT`, `REGION` (simulated, e.g. Ahmedabad/Mumbai/Delhi), `CACHE_DIR=storage/edges/<id>`, `CACHE_TTL_SECONDS` (default 60), `CACHE_MAX_ENTRIES` or `CACHE_MAX_BYTES`.

- `GET /health` → `{status:"healthy", nodeId, uptime}`. It also updates `last_heartbeat`.
- `GET /serve/:projectId/*path` (called by the gateway):
  1. Compute cache key `projectId:path`.
  2. Look up the entry (in-memory index, persisted to disk). If present **and** `now < expires_at` → **HIT**: update `last_accessed_at` and `hit_count`, stream the file from the edge cache dir, and set `X-Cache: HIT`, `X-Edge-Node`.
  3. Missing or expired → **MISS**: fetch from Origin, write to the edge cache dir, insert/update the CacheEntries row (`created_at`, `expires_at`, `ttl_seconds`), set `X-Cache: MISS`, and return. An expired entry is treated as a MISS and refreshed (use ETag revalidation if implemented).
  4. **LRU eviction:** if adding would exceed capacity, delete the entry with the oldest `last_accessed_at` (file + row) until there is room. Log `[CACHE] EVICT`.
  5. Origin 404 → return 404 (do not cache errors, or use a very short negative TTL). Origin unreachable → 502.
  6. Add `ETag`, `Cache-Control`, and `304` on `If-None-Match`. Add gzip/brotli via `Accept-Encoding` where practical.
- `POST /internal/purge` with body `{scope:"all"|"project"|"deployment", projectId?, deploymentId?}` (internal-token protected). It deletes files and index entries and returns the count purged.
- On startup: reconcile the disk cache with the CacheEntries table, and **purge any project that was invalidated while the node was down** (compare against a `purged_at`/active-deployment marker fetched from the backend).
- Per-request structured log: `[REQUEST] GET /index.html [EDGE] edge-1 [CACHE] HIT [LATENCY] 4ms`. On MISS also log `[ORIGIN] Fetching file` and `[CACHE] Stored`.

## 11. GATEWAY: RATE LIMITER + LOAD BALANCER (`gateway/`, :8080)

Order per visitor request: **Rate Limiter → project resolution → Load Balancer → proxy to edge → log**.

**Project resolution:** by `Host` header (`<slug>.localhost:8080`, looked up in Domains). Fallback: path prefix `/_site/<slug>/...`. Because wildcard `*.localhost` may not resolve on every OS, both must work and be documented.

**Rate limiter** (FR-RL-01..03, NFR-PERF-03). Algorithm: **Token Bucket** (allows short bursts, enforces an average rate). Explain the choice in `ARCHITECTURE.md`, along with the Fixed/Sliding Window trade-offs from the Explainer.
- Key = client IP (respect `X-Forwarded-For` only if `TRUST_PROXY=true`), optionally + endpoint. Config: `RATE_LIMIT_CAPACITY`, `RATE_LIMIT_REFILL_PER_SEC` (or a window + max-requests equivalent), `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX_REQUESTS`. Document the mapping.
- State is in memory (O(1) per request) and flushed **asynchronously** in batches to the `RateLimits` table for visibility, never on the hot path.
- Over the limit → **HTTP 429** with `Retry-After: <seconds>` (computed from the refill time) and a clear body, e.g. "Too many requests. Retry in N seconds." Log `[RATE_LIMIT] IP blocked`.
- Admin-blocked IPs (`is_blocked`) → 403/429 immediately (reload block state periodically or via internal notify).
- Also apply a stricter limit to `/api/auth/login` and `/api/auth/signup` on the backend (brute-force protection).
- Blocked/limited requests are still recorded in RequestLogs (status 429, cache_result NONE).

**Load balancer:**
- **Round Robin** over the currently HEALTHY edges (mandatory).
- **Optional region routing:** the `X-Edge-Region: Mumbai` header prefers the edge with that region if healthy, else falls back to round robin. Label it "simulated" everywhere.
- **Health checker:** every `HEALTH_INTERVAL_MS` (default 5s), `GET /health` on each edge with a short timeout. N consecutive failures → `UNHEALTHY`/`OFFLINE`, removed from rotation, and the state is written to `EdgeNodes`. When it responds again → `HEALTHY` and rejoins. If the proxied call itself fails mid-request, mark it suspect and **retry once on another healthy edge**. If no edges are healthy → 503 with a clear message.
- Pass `X-Cache`, `X-Edge-Node`, and an optional `X-Served-By` back to the client so demos can show which node answered.

**Request logging (FR-AN-01):** after each response, buffer a RequestLogs row (timestamp, IP, project, domain, path, method, status, latency, edge node, cache result) and batch-insert. Do this off the hot path, and flush on shutdown.

## 12. ANALYTICS AND ADMIN (FR-AN-02, FR-AN-03)

**Developer (own projects only; raw SQL aggregations):**
`GET /api/projects/:id/analytics` (summary), `/analytics/traffic?range=1h|24h|7d` (requests over time, bucketed), `/analytics/cache` (hits, misses, ratio = HITs / (HITs+MISSes) × 100, excluding NONE), `/analytics/latency` (avg, min, max, and p95 if easy, split by HIT vs MISS to show HIT is faster), plus deployment stats (count, success, failed, average duration). Render with Recharts.

**Admin (`/api/admin/*`, ADMIN only):**
- `GET /admin/overview`: total users, projects, deployments, success/failed, total requests, global hit ratio, average latency.
- `GET /admin/users`, `PATCH /admin/users/:id/block|unblock`
- `GET /admin/projects`, `GET /admin/deployments`
- `GET /admin/edges` and `GET /admin/health`: per node: name, port, region, status, requests, cache entries, last health check.
- `POST /admin/cache/purge` {scope:"all"|"project"|"edge"|"deployment", ids}. It calls the edges' internal purge and returns counts.
- `GET /admin/rate-limits` (top offenders, blocked IPs), `POST /admin/rate-limits/block`, `POST /admin/rate-limits/unblock`, and GET/PATCH rate-limit settings if practical.
- Developers calling admin routes → 403.

Provide a developer-level "Purge cache" for their own project (scoped to that project).

## 13. FRONTEND (Next.js + TypeScript)

Modern developer-platform look: sidebar + top bar, cards, tables, status badges, deployment timeline, terminal-style log panel, charts, edge health indicators. Responsive. No generic CRUD look. Loading, empty and error states everywhere.

Routes: `/login`, `/signup`, `/dashboard`, `/projects` (+ new), `/projects/[id]` (name, repo, current deployment, status, production URL, last deploy, build duration; buttons Deploy / Redeploy / View Logs / Analytics / Settings / Purge Cache), `/projects/[id]/deployments`, `/projects/[id]/deployments/[deploymentId]` (id, commit SHA, branch, start/finish, duration, status, live log panel), `/projects/[id]/analytics`, `/projects/[id]/settings`, and `/admin`, `/admin/users`, `/admin/projects`, `/admin/deployments`, `/admin/edges`, `/admin/cache`, `/admin/rate-limits`, `/admin/analytics`. Route guards by role.

- **Status is unmistakable:** QUEUED (grey), BUILDING (animated), SUCCESS (green), FAILED (red) (NFR-USE-01).
- **Polling** every ~2s for in-progress deployments and logs (no WebSockets unless trivial). Stop polling when terminal.
- **Errors in plain language** (NFR-USE-02): failed build shows the failing command, exit code and last stderr lines; 429 shows a "slow down, retry in N s" message; edge outages are shown in the admin health list.
- Admin health = status list + simple charts (NFR-USE-03).
- Include a small "Try it" panel on the project page that fetches the live site and shows the `X-Cache` and `X-Edge-Node` headers (via a backend helper endpoint if CORS gets in the way).

## 14. ERRORS, SECURITY, CONFIG

- Central Fastify error handler with consistent JSON `{error:{code,message,details?}}`. Codes: 400, 401, 403, 404, 409, 422, 429, 500. **Never leak** stack traces, SQL, DB credentials, JWT secret, filesystem paths, env values or GitHub secrets.
- Security checklist (all must be implemented and tested): password hashing, JWT on protected routes, RBAC, input validation, parameterized SQL (no string-concatenated SQL), webhook signature verification, path-traversal protection (build, origin, edge), repo URL validation, rate limiting, CORS allow-list, scrubbed build env, admin route protection, `.env` git-ignored, `.env.example` committed.
- `.env.example` includes: `DATABASE_URL` (or DB_HOST/USER/PASSWORD/NAME), `JWT_SECRET`, `JWT_EXPIRES_IN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `GITHUB_TOKEN` (optional), `GITHUB_WEBHOOK_SECRET` (fallback only), `PUBLIC_WEBHOOK_URL`, `INTERNAL_API_TOKEN`, `STORAGE_PATH`, `ORIGIN_PORT`, `BACKEND_PORT`, `GATEWAY_PORT`, `EDGE_NODE_PORTS`, `EDGE_REGIONS`, `CACHE_TTL_SECONDS`, `CACHE_MAX_ENTRIES`, `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_CAPACITY`, `RATE_LIMIT_REFILL_PER_SEC`, `BUILD_TIMEOUT_MS`, `MAX_LOG_BYTES`, `BUILD_CONCURRENCY`, `KEEP_DEPLOYMENTS`, `HEALTH_INTERVAL_MS`, `ALLOW_LOCAL_REPOS`, `TRUST_PROXY`, `CORS_ORIGIN`. The README documents every variable. **No real secrets anywhere.**

## 15. IMPLEMENTATION PHASES (with gates)

0. **Analyze** the repo and both PDFs. Write `docs/DECISIONS.md` and a requirement traceability skeleton.
1. Monorepo scaffold, TypeScript, lint, scripts, shared config/logger/DB pool.
2. MySQL schema, migrations, seed. **Gate:** all 12 tables exist; seed works.
3. Auth + users + RBAC. **Gate:** auth tests pass.
4. Project management + ownership. **Gate:** cross-user access denied.
5. GitHub integration (repo validation, API, webhook registration, fallback).
6. Webhook handler with signature verification. **Gate:** signed and unsigned tests.
7. Deployment service, job queue, state machine.
8. Build service (clone, exact commit, install, build, limits, logs, publish, cleanup). **Gate:** real success and real failure builds using a fixture repo; failed build leaves active version intact.
9. Origin server.
10. Edge nodes with cache (TTL, LRU, purge). **Gate:** HIT/MISS/TTL/LRU/purge tests.
11. Gateway: load balancer + health checker. **Gate:** round-robin, node down/up tests.
12. Rate limiter. **Gate:** 429 + Retry-After + refill tests.
13. Request logging + analytics endpoints.
14. Cache invalidation on deploy wired end-to-end.
15. Developer dashboard.
16. Admin dashboard.
17. Demo scripts (see §16).
18. Full automated tests + coverage of the checklist in §17.
19. Documentation.
20. End-to-end acceptance run (§18) and requirement matrix (§19).

## 16. DEMO MODE (scripts in `scripts/`, each prints clear results)

- `demo:roundrobin`: N requests → shows Edge 1, 2, 3, 1, 2, 3.
- `demo:cache`: first request MISS (origin contacted), second HIT (origin not contacted), with latency for both.
- `demo:invalidation`: deploy a new version → purge logged → next request MISS → new content.
- `demo:ratelimit`: 200, 200, … then 429 with Retry-After.
- `demo:failover`: kill an edge → it goes UNHEALTHY → traffic alternates only among healthy nodes → restart → it rejoins.
- `simulate-webhook`: signed push payload against the local backend.
- Include a tiny fixture static site (its own repo folder, built with a simple `npm run build` that copies to `dist/`) so demos work offline via `ALLOW_LOCAL_REPOS`.

## 17. AUTOMATED TESTS (must exist and pass)

- **Auth:** signup, duplicate signup, login, wrong password, blocked user, invalid/expired/missing JWT, role authorization.
- **Projects:** create, read own, denied on another user's project.
- **Webhook/Deployment:** valid signature accepted, bad signature rejected, non-push and wrong-branch ignored; clone at exact SHA; install; build; success path; failed build path; timeout kill; log truncation; path-traversal in output dir rejected; deployment logs persisted; **failed deployment does not replace the active one**; state-machine illegal transitions rejected.
- **Cache:** HIT, MISS, TTL expiry, LRU eviction, purge (project/edge/all), invalidation after deploy.
- **Load balancer:** round robin order, unhealthy removal, restoration, region header, all-down 503.
- **Rate limiter:** allowed, limit exceeded, 429, Retry-After correctness, refill/reset, admin block/unblock.
- **Analytics:** logging, traffic buckets, hit ratio formula, latency min/avg/max, developer isolation.
- **Perf sanity:** measured HIT latency is lower than MISS latency (report numbers, avoid flaky hard thresholds).
- **Origin/edge:** traversal attempts blocked.

## 18. END-TO-END ACCEPTANCE (must actually run; record evidence in `docs/E2E_REPORT.md`)

Start MySQL, backend, origin, gateway, frontend and 3 edges. Sign up, log in, create a project, connect a repo, set the build command, register a webhook. Push (or `simulate-webhook`) → webhook verified → deployment QUEUED→BUILDING→SUCCESS with logs → files published → active version set → edge caches purged. Visitor request: rate limiter → load balancer → edge → first request **MISS**, second **HIT**. Analytics show both requests and an updated hit ratio. Stop an edge → detected → removed → traffic continues on healthy nodes. Flood requests → **429 + Retry-After**. Admin dashboard shows the unhealthy node, traffic, cache and deployment analytics; admin purges the cache → next request MISS. Push a broken commit → FAILED, **old site still served**. Push a good commit → SUCCESS → cache purged → visitors get the new version.

## 19. REQUIREMENT COMPLIANCE MATRIX (`docs/REQUIREMENTS_MATRIX.md`)

Columns: **Requirement ID | Requirement | Implementation | File/Module | API | Test | Status**. Mark PASS only if a test or recorded E2E step proves it. Use these IDs (one row per SRS bullet, so nothing is omitted):

- **FR-AUTH-01..04**: signup; login+JWT; two roles; admin view/block/unblock users.
- **FR-PROJ-01..03**: create project + link repo; register webhook; configure build settings.
- **FR-DEP-01..07**: receive webhook; clone exact commit; isolated install+build; store files + Deployment with logs/status; publish to Origin + mark active; purge all edges after deploy; developer views logs/history for own projects.
- **FR-CDN-01..06**: rate limiter first; load balancer chooses edge; check local cache (HIT); MISS → origin → store → return; TTL per file; LRU eviction.
- **FR-RL-01..03**: count per IP (+endpoint) in a window; 429 + Retry-After; at least one algorithm.
- **FR-LB-01..03**: round robin; optional header/region routing; health checks + removal.
- **FR-AN-01..03**: record every request; developer charts (traffic, latency, hit ratio); admin dashboard (health, edge status, purge, block).
- **NFR-PERF-01..03**: HIT faster than MISS; small-site deploy within minutes; low limiter/LB overhead.
- **NFR-SEC-01..04**: JWT required; hashed passwords; admin-only actions; rate limiter as basic abuse protection.
- **NFR-USE-01..03**: visible status; clear errors; scannable admin health.
- **NFR-REL-01..03**: edge failover; failed deploy keeps active; logs durably stored.
- **NFR-SCA-01..02**: add edges via config only; schema supports many rows (indexes justified).
- **NFR-MNT-01..02**: modular code; organized readable raw SQL.

Also list the **Limitations** from SRS §7.2 as explicitly-not-implemented items.

## 20. DOCUMENTATION (generate all)

`README.md` (plain-language overview, exact setup commands: install, create DB, run migrations + seed, run each process, default ports, demo credentials via env), `ARCHITECTURE.md` (both pipelines with diagrams, CDN, cache, LB, rate limiter, origin, DB, algorithm choices), `API.md`, `DATABASE.md` (ERD + table purposes), `DEPLOYMENT.md` (local run, exposing the webhook), `TESTING.md`, `TROUBLESHOOTING.md`, `docs/DECISIONS.md`, `docs/LIMITATIONS.md`, `docs/REQUIREMENTS_MATRIX.md`, `docs/E2E_REPORT.md`.

## 21. DEFINITION OF DONE

Everything runs from a clean clone using the README alone. All tests pass. The E2E scenario in §18 has been executed and evidenced. Every matrix row is PASS or an honest, documented limitation. No scope-excluded technology appears anywhere. Every design decision can be defended in a university viva.

**Begin with Phase 0. Report your repo inspection and your `DECISIONS.md` draft before writing feature code.**
