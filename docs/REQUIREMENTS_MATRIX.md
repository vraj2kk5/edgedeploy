# Requirements Compliance Traceability Matrix (docs/REQUIREMENTS_MATRIX.md)

| Requirement ID | Requirement Description | Implementation Details | File / Module | API Endpoint | Test Verification | Status |
|---|---|---|---|---|---|---|
| **FR-AUTH-01** | User Signup & Validation | Password hashing >= 10 cost, Zod email validation | `backend/src/routes/auth.routes.ts` | `POST /api/auth/signup` | `tests/suite.test.ts` | PASS |
| **FR-AUTH-02** | User Login & JWT Emission | Password comparison, JWT token generation | `backend/src/routes/auth.routes.ts` | `POST /api/auth/login` | `tests/suite.test.ts` | PASS |
| **FR-AUTH-03** | Role-Based Access Control (RBAC) | DEVELOPER & ADMIN roles enforced | `backend/src/middleware/auth.ts` | All `/api/admin/*` | `tests/suite.test.ts` | PASS |
| **FR-AUTH-04** | Admin User Management | List users, block/unblock accounts | `backend/src/routes/admin-users.routes.ts` | `PATCH /api/admin/users/:id/block` | `tests/suite.test.ts` | PASS |
| **FR-PROJ-01** | Create Project & Link Repo | Project CRUD, domain auto-generation | `backend/src/routes/projects.routes.ts` | `POST /api/projects` | `tests/suite.test.ts` | PASS |
| **FR-PROJ-02** | Webhook Registration & Fallback | Register GitHub webhook, offline fallback | `backend/src/routes/projects.routes.ts` | `POST /api/projects/:id/repository` | `scripts/simulate-webhook.ts` | PASS |
| **FR-PROJ-03** | Configure Build Settings | Build/install commands, branch, output dir | `backend/src/repositories/projects.repo.ts` | `PATCH /api/projects/:id` | `tests/suite.test.ts` | PASS |
| **FR-DEP-01** | Receive GitHub Webhook | HMAC-SHA256 signature check, timing safe | `backend/src/routes/webhooks.routes.ts` | `POST /api/webhooks/github` | `scripts/simulate-webhook.ts` | PASS |
| **FR-DEP-02** | Clone Exact Commit SHA | `simple-git` clone & checkout exact commit | `backend/src/services/build.service.ts` | Build Queue | `tests/suite.test.ts` | PASS |
| **FR-DEP-03** | Isolated Install & Build | Subprocess spawn, scrubbed env, timeout | `backend/src/services/build.service.ts` | Build Worker | `tests/suite.test.ts` | PASS |
| **FR-DEP-04** | Store Files & Logs | Real-time DeploymentLogs streaming, Files insert | `backend/src/repositories/deployments.repo.ts` | `GET /api/deployments/:id/logs` | `tests/suite.test.ts` | PASS |
| **FR-DEP-05** | Publish to Origin & Atomic Update | Atomic SQL transaction updates active deployment | `backend/src/repositories/deployments.repo.ts` | `publishDeploymentSuccessTransaction` | `tests/suite.test.ts` | PASS |
| **FR-DEP-06** | Edge Cache Purge on Deploy | Broadcasts `/internal/purge` to edges | `backend/src/services/build.service.ts` | `POST /internal/purge` | `scripts/demo-invalidation.ts` | PASS |
| **FR-DEP-07** | Developer View Logs & History | Polling endpoint for live build logs | `frontend/app/projects/[id]/deployments/[deploymentId]` | `GET /api/deployments/:id/logs` | UI Verification | PASS |
| **FR-CDN-01** | Rate Limiter First Pipeline | Token Bucket executed before LB/Edge | `gateway/src/index.ts` | Gateway Handler | `scripts/demo-ratelimit.ts` | PASS |
| **FR-CDN-02** | Load Balancer Edge Selection | Round Robin rotation over healthy edges | `gateway/src/index.ts` | Load Balancer | `scripts/demo-roundrobin.ts` | PASS |
| **FR-CDN-03** | Check Edge Cache (HIT) | In-memory + disk lookup, returns X-Cache HIT | `edge-node/src/index.ts` | `GET /serve/:projectId/*` | `scripts/demo-cache.ts` | PASS |
| **FR-CDN-04** | Cache MISS -> Origin -> Store | Fetches from Origin, stores file, returns MISS | `edge-node/src/index.ts` | `GET /serve/:projectId/*` | `scripts/demo-cache.ts` | PASS |
| **FR-CDN-05** | File TTL Expiration | Configurable TTL, expired entries refreshed | `edge-node/src/index.ts` | Edge Serving | `tests/suite.test.ts` | PASS |
| **FR-CDN-06** | LRU Eviction | Deletes oldest `last_accessed_at` when full | `edge-node/src/index.ts` | `evictOldestEntryIfNeeded` | `tests/suite.test.ts` | PASS |
| **FR-RL-01** | Token Bucket Counter per IP | Memory bucket + async SQL flush | `gateway/src/index.ts` | `checkRateLimit` | `scripts/demo-ratelimit.ts` | PASS |
| **FR-RL-02** | HTTP 429 & Retry-After | Returns 429 status and calculated Retry-After | `gateway/src/index.ts` | Gateway Handler | `scripts/demo-ratelimit.ts` | PASS |
| **FR-RL-03** | Rate Limiting Algorithm | Token Bucket algorithm implemented | `gateway/src/index.ts` | Token Bucket Engine | `scripts/demo-ratelimit.ts` | PASS |
| **FR-LB-01** | Round Robin Load Balancing | Rotates requests across healthy edge nodes | `gateway/src/index.ts` | `selectEdgeNode` | `scripts/demo-roundrobin.ts` | PASS |
| **FR-LB-02** | Region Preference Header | Optional `X-Edge-Region` routing | `gateway/src/index.ts` | `selectEdgeNode` | Unit Code Test | PASS |
| **FR-LB-03** | Active Health Checks & Failover | Periodic 5s health probes, auto-rejoin | `gateway/src/index.ts` | `startHealthCheckLoop` | `scripts/demo-failover.ts` | PASS |
| **FR-AN-01** | Async Request Logging | Off-hot-path batch insert to RequestLogs | `gateway/src/index.ts` | `bufferRequestLog` | DB Verification | PASS |
| **FR-AN-02** | Developer Analytics Charts | Traffic buckets, latency split, hit ratio | `backend/src/routes/analytics.routes.ts` | `GET /api/projects/:id/analytics` | UI Verification | PASS |
| **FR-AN-03** | Admin Dashboard Telemetry | Overview stats, user block, edge health, purge | `backend/src/routes/admin.routes.ts` | `GET /api/admin/overview` | UI Verification | PASS |
| **NFR-PERF-01** | HIT Faster than MISS | Measured HIT latency lower than MISS latency | `edge-node/src/index.ts` | Serving Pipeline | `scripts/demo-cache.ts` | PASS |
| **NFR-PERF-02** | Fast Deploy | Deploy completes within minutes | `backend/src/services/build.service.ts` | Build Queue | Pipeline Test | PASS |
| **NFR-PERF-03** | Low Limiter Overhead | O(1) in-memory bucket lookup | `gateway/src/index.ts` | Rate Limiter | Benchmark | PASS |
| **NFR-SEC-01** | JWT Authentication | Bearer JWT required on protected routes | `backend/src/middleware/auth.ts` | Middleware | `tests/suite.test.ts` | PASS |
| **NFR-SEC-02** | Password Hashing | BCrypt hashing for all user passwords | `backend/src/routes/auth.routes.ts` | Auth Routes | `tests/suite.test.ts` | PASS |
| **NFR-SEC-03** | Admin Route Protection | `requireRole('ADMIN')` on all admin endpoints | `backend/src/middleware/auth.ts` | Admin Routes | `tests/suite.test.ts` | PASS |
| **NFR-SEC-04** | Abuse Protection | Token bucket rate limiting at gateway entry | `gateway/src/index.ts` | Rate Limiter | `scripts/demo-ratelimit.ts` | PASS |
| **NFR-USE-01** | Visible Status Badges | QUEUED, BUILDING, SUCCESS, FAILED badges | `frontend/app/projects/[id]/page.tsx` | Dashboard UI | UI Verification | PASS |
| **NFR-USE-02** | Plain Language Errors | Clear error messages for 429, 401, 503 | `backend/src/app.ts` | Error Handler | Verification | PASS |
| **NFR-USE-03** | Scannable Admin Health | Real-time status cards for edge nodes | `frontend/app/admin/edges/page.tsx` | Admin UI | UI Verification | PASS |
| **NFR-REL-01** | Edge Node Failover | Unhealthy nodes removed, traffic preserved | `gateway/src/index.ts` | Load Balancer | `scripts/demo-failover.ts` | PASS |
| **NFR-REL-02** | Failed Deploy Invariant | Failed build leaves active version intact | `backend/src/services/build.service.ts` | Build Service | `tests/suite.test.ts` | PASS |
| **NFR-REL-03** | Durable Logs Persistence | DeploymentLogs stored in DB for review | `backend/src/repositories/deployments.repo.ts` | DeploymentLogs | `tests/suite.test.ts` | PASS |
| **NFR-SCA-01** | Config-Only Edge Nodes | Adding edges is configuration only | `gateway/src/index.ts` | `EDGE_NODE_PORTS` | Config Test | PASS |
| **NFR-SCA-02** | Relational Indexing | Indexes on `(project_id, ts)` and `(ts)` | `database/schema.sql` | DB Schema | DB Verification | PASS |
| **NFR-MNT-01** | Modular Code Architecture | Monorepo workspaces (`backend`, `gateway`...) | Monorepo Structure | Workspace Packages | Build Verification | PASS |
| **NFR-MNT-02** | Raw SQL Repository Pattern | No SQL in routes; isolated in `.repo.ts` | `backend/src/repositories/` | Repositories | Code Audit | PASS |
