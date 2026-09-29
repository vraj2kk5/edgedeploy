# Architectural Decisions (docs/DECISIONS.md)

This document records key architectural decisions, trade-offs, and requirement conflict resolutions for **EdgeDeploy**.

---

## Decision 1: Specification Conflict Resolution (SRS vs Explainer)
- **Context:** The SRS document is designated as the primary source of truth, while the Project Explainer is secondary. A conflict exists regarding serving pipeline sequence: the Explainer sequence omits the Rate Limiter from its top-level flow diagram, but Part B explicitly places the Rate Limiter before Load Balancing.
- **Decision:** Follow SRS §3.4 and Part B. The Serving Pipeline sequence is strictly enforce as:
  `Visitor Request → Rate Limiter → Project Resolution → Load Balancer → Edge Node (Cache Lookup) → Origin Server (if Cache Miss)`
- **Rationale:** Processing rate limits *before* load balancing protects downstream edge nodes and origin servers from excessive connection overhead and abuse.

---

## Decision 2: MySQL Raw SQL Architecture (No ORM)
- **Context:** SRS §5.2 and Master Prompt §2 dictate using raw SQL queries with `mysql2` parameterized inputs. ORMs (Prisma, TypeORM, Drizzle) are strictly prohibited.
- **Decision:** Implement dedicated domain repository modules (e.g., `backend/src/repositories/projects.repo.ts`) containing parameterized raw SQL statements (`mysql2/promise`).
- **Rationale:** Prevents SQL injection, eliminates ORM abstraction overhead, provides direct visibility into relational schema indexing, and maintains high academic clarity for code viva.

---

## Decision 3: Rate Limiting Algorithm Selection
- **Context:** EdgeDeploy requires client IP rate limiting at the gateway level. Standard options include Fixed Window, Sliding Window, and Token Bucket.
- **Decision:** Implement the **Token Bucket** algorithm in gateway memory with asynchronous batch persistence to `RateLimits` database table.
- **Rationale:** Token Bucket allows legitimate burst traffic up to bucket capacity while enforcing a smooth average rate refill. Offloading state updates from the hot request path to an async SQL flush prevents gateway latency bottlenecks.

---

## Decision 4: Edge Node Architecture & Multi-Process Simulation
- **Context:** Edge nodes must operate independently without relying on container orchestration (Docker/Kubernetes).
- **Decision:** Run Edge Nodes as independent Node.js processes listening on separate ports (e.g., `:4101`, `:4102`, `:4103`), declared in `EDGE_NODE_PORTS` environment configuration and registered in the `EdgeNodes` database table.
- **Rationale:** Enables true local process-level distribution, process failure simulation, independent disk cache storage (`storage/edges/edge-N/`), and live health monitoring without requiring containerization.

---

## Decision 5: Atomic Deployment Invariant Protection
- **Context:** Failing or in-progress builds must never corrupt live traffic or serve partial assets.
- **Decision:** Static build output is written to an isolated directory (`storage/builds/deployment-<id>`). Only upon successful build execution and static file verification are assets copied to `storage/origin/<projectId>/<deploymentId>/`, and `Projects.active_deployment_id` updated inside a single atomic database transaction.
- **Rationale:** Guarantees zero downtime and guarantees that a failed deployment leaves the existing active deployment 100% operational.
