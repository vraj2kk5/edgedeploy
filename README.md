# EdgeDeploy: Distributed Edge Hosting Platform

> **Academic Edge Hosting Platform with CDN, Automatic Deployment, Load Balancing, Intelligent Rate Limiting, and Raw SQL Relational Modeling.**
> Developed for GSFC University (AWT Course). Mini Vercel / Netlify + Cloudflare simulator.

---

## 🚀 Quick Start Guide

### 1. Prerequisites & Environment
Ensure **Node.js (v18+)**, **MariaDB / MySQL 8**, and **Git** are installed on your machine.

Start your MySQL server on `127.0.0.1:3306` with user `root` (no password), or update `.env`.

### 2. Install Dependencies
```bash
npm install
```

### 3. Initialize Database Schema & Seed Data
```bash
npm run db:migrate
npm run db:seed
```

### 4. Start Monorepo Services
```bash
npm run dev
```
Starts all 5 core platform components concurrently:
- **Frontend Dashboard**: `http://localhost:3000`
- **Backend Control Plane**: `http://localhost:3001`
- **Origin Server**: `http://localhost:4000`
- **Gateway Load Balancer & Rate Limiter**: `http://localhost:8080`
- **Edge Node Cluster**:
  - `edge-1`: `http://localhost:4101` (Mumbai)
  - `edge-2`: `http://localhost:4102` (Ahmedabad)
  - `edge-3`: `http://localhost:4103` (Delhi)

---

## 🔐 Default Demo Credentials

| Role | Email | Password |
|---|---|---|
| **System Admin** | `admin@edgedeploy.local` | `AdminPassword123!` |
| **Developer** | `dev@edgedeploy.local` | `DevPassword123!` |

---

## ⚡ Demo Scripts

Run interactive viva demonstration scripts while `npm run dev` is running:

```bash
# 1. Demonstrate Round-Robin Load Balancing across edge processes
npm run demo:roundrobin

# 2. Demonstrate Cache HIT vs MISS latency performance
npm run demo:cache

# 3. Demonstrate Token Bucket Rate Limiting (429 Too Many Requests + Retry-After)
npm run demo:ratelimit

# 4. Demonstrate Edge Node failure detection and seamless failover
npm run demo:failover

# 5. Demonstrate Automatic Deployment Cache Invalidation
npm run demo:invalidation

# 6. Simulate GitHub Webhook signed push payload
npm run simulate-webhook
```

---

## 🧪 Running Automated Tests

```bash
npm test
```
Runs the Vitest suite covering Auth, RBAC, Webhooks, Build Queue, Invariant Protections, Cache Eviction, and Rate Limiter logic.

---

## 📁 Monorepo Workspace Structure

```
edgedeploy/
├── shared/           # DB pool, Zod schemas, Pino logger, TS types
├── database/         # schema.sql (12 tables), migrations/, migrate.ts, seed.ts
├── backend/          # Control Plane REST API, GitHub webhooks, build queue
├── origin/           # Internal Origin Server (serves active site files)
├── edge-node/        # Edge cache processes (:4101, :4102, :4103...)
├── gateway/          # Token Bucket Rate Limiter -> Round Robin Load Balancer
├── frontend/         # Next.js 14+ App Router Developer & Admin Dashboard
├── fixtures/         # Sample static site fixture for offline demos
├── scripts/          # Runnable demo scripts
├── tests/            # Vitest suite
└── docs/             # ARCHITECTURE.md, DECISIONS.md, LIMITATIONS.md, E2E_REPORT.md, REQUIREMENTS_MATRIX.md
```

---

## 📜 Documentation Index
- [ARCHITECTURE.md](file:///c:/Users/Asus/OneDrive/Desktop/edgedeploy/ARCHITECTURE.md)
- [API.md](file:///c:/Users/Asus/OneDrive/Desktop/edgedeploy/API.md)
- [DATABASE.md](file:///c:/Users/Asus/OneDrive/Desktop/edgedeploy/DATABASE.md)
- [DEPLOYMENT.md](file:///c:/Users/Asus/OneDrive/Desktop/edgedeploy/DEPLOYMENT.md)
- [TESTING.md](file:///c:/Users/Asus/OneDrive/Desktop/edgedeploy/TESTING.md)
- [TROUBLESHOOTING.md](file:///c:/Users/Asus/OneDrive/Desktop/edgedeploy/TROUBLESHOOTING.md)
- [docs/DECISIONS.md](file:///c:/Users/Asus/OneDrive/Desktop/edgedeploy/docs/DECISIONS.md)
- [docs/LIMITATIONS.md](file:///c:/Users/Asus/OneDrive/Desktop/edgedeploy/docs/LIMITATIONS.md)
- [docs/REQUIREMENTS_MATRIX.md](file:///c:/Users/Asus/OneDrive/Desktop/edgedeploy/docs/REQUIREMENTS_MATRIX.md)
- [docs/E2E_REPORT.md](file:///c:/Users/Asus/OneDrive/Desktop/edgedeploy/docs/E2E_REPORT.md)
