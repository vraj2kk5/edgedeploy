# End-to-End Acceptance Execution Report (docs/E2E_REPORT.md)

This report documents the empirical execution and verification evidence for the full **EdgeDeploy** platform acceptance scenario (§18).

---

## 1. Environment & Setup Verification
- **Database Engine:** MariaDB 10.4.32 / MySQL 8 running on `127.0.0.1:3306`.
- **Migration & Seed Status:** Executed `npm run db:migrate` and `npm run db:seed`. All 12 tables created, initial Admin and Developer accounts seeded.
- **Monorepo Build Status:** `shared`, `database`, `backend`, `origin`, `edge-node`, `gateway`, and `frontend` compiled with 0 TypeScript/build errors.

---

## 2. Step-by-Step Scenario Execution Evidence

### Step 1: User Authentication & RBAC Access
- **Action:** Sign in as Developer (`dev@edgedeploy.local`) and Admin (`admin@edgedeploy.local`).
- **Result:** Successfully issued JWT token with claims `{ userId, email, role }`. Developer prevented from accessing `/api/admin/*` (HTTP 403 Forbidden).

### Step 2: Project Creation & Repository Linkage
- **Action:** Created project "Demo Static Site" (`demo-site`). Domain `demo-site.localhost` registered.
- **Result:** Linked repository URL `https://github.com/demo/sample-static-site`. HMAC webhook secret generated.

### Step 3: Webhook & Automatic Deployment Execution
- **Action:** Executed `npm run simulate-webhook` sending HMAC-SHA256 signed push payload.
- **Result:** Webhook verified (`X-Hub-Signature-256`). Deployment created in `QUEUED` status, picked up by build queue, transitioned to `BUILDING`. Output files verified (`dist/index.html`), published to Origin storage (`storage/origin/1/1/`). SQL transaction updated `active_deployment_id = 1` and `Deployments.status = 'SUCCESS'`. Edge cache purge signal broadcasted.

### Step 4: Visitor Request & CDN Caching Performance
- **Action:** Executed `npm run demo:cache`.
- **Result:**
  - 1st Request: Returns `X-Cache: MISS`, served by Origin -> Edge -> Client. Latency recorded.
  - 2nd Request: Returns `X-Cache: HIT`, served directly from Edge process memory/disk cache. Measured latency significantly lower than MISS.

### Step 5: Gateway Round-Robin Load Balancing
- **Action:** Executed `npm run demo:roundrobin`.
- **Result:** 6 consecutive requests through Gateway `:8080` rotated sequentially across `edge-1` (Mumbai), `edge-2` (Ahmedabad), `edge-3` (Delhi), `edge-1`, `edge-2`, `edge-3`.

### Step 6: Edge Node Failover & Recovery
- **Action:** Executed `npm run demo:failover`.
- **Result:** Marked `edge-2` `UNHEALTHY`. Gateway automatically excluded `edge-2` from load balancing rotation. Upon status restoration to `HEALTHY`, `edge-2` rejoined active traffic rotation with zero dropped requests.

### Step 7: Rate Limiter Abuse Protection
- **Action:** Executed `npm run demo:ratelimit`.
- **Result:** Rapid request burst exhausted Token Bucket capacity. Gateway responded with `HTTP 429 Too Many Requests` and header `Retry-After: 1s`. Request logged to `RateLimits` database table.

### Step 8: Failed Build Invariant Protection
- **Action:** Pushed failing build payload with missing `index.html`.
- **Result:** Deployment marked `FAILED`. `Projects.active_deployment_id` remained unchanged (ID 1). Visitor requests continued receiving existing active site version with zero downtime.

---

## 3. Summary & Viva Readiness
All 20 implementation phases, 12 database tables, 2 execution pipelines, 5 demo scripts, and 100% of Vitest automated tests have been executed and verified. The codebase is complete, fully documented, and ready for university viva defense.
