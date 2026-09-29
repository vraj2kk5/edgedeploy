# EdgeDeploy Deployment & Local Execution Guide

## Local Monorepo Run

1. Ensure MySQL Server / MariaDB is active on `127.0.0.1:3306`.
2. Apply schema and seed data:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
3. Launch all processes concurrently:
   ```bash
   npm run dev
   ```

---

## Service Port Mapping

| Component | Port | Description |
|---|---|---|
| **Frontend** | `:3000` | Next.js Developer & Admin Dashboard |
| **Backend** | `:3001` | Control Plane REST API & Webhook Listener |
| **Origin** | `:4000` | Static Site Storage Server |
| **Gateway** | `:8080` | Token Bucket Rate Limiter -> Round Robin LB Entry |
| **Edge 1** | `:4101` | Edge Process 1 (Mumbai Region) |
| **Edge 2** | `:4102` | Edge Process 2 (Ahmedabad Region) |
| **Edge 3** | `:4103` | Edge Process 3 (Delhi Region) |

---

## Exposing Webhook Locally (ngrok / smee)

To receive real GitHub webhooks locally:
1. Run `ngrok http 3001`.
2. Update `PUBLIC_WEBHOOK_URL` in `.env` with your ngrok HTTPS URL (`https://xxxx.ngrok-free.app`).
3. Set your GitHub Webhook payload URL to `https://xxxx.ngrok-free.app/api/webhooks/github`.
