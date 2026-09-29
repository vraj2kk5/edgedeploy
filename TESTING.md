# EdgeDeploy Testing Guide

EdgeDeploy includes both an automated Vitest unit/integration test suite and interactive demonstration scripts.

---

## 1. Automated Vitest Suite

Run all automated unit and integration tests:

```bash
npm test
```

### Test Coverage Checklist:
- **Auth & JWT:** Signup, login, password hashing, blocked user 403, JWT claim verification.
- **Projects:** Project creation, ownership checks, cross-user isolation.
- **Webhook & Deployments:** HMAC signature validation, commit checkout, **failed build invariant verification (active deployment preserved)**.
- **Cache Engine:** HIT, MISS, TTL expiration, LRU eviction, purge signals.
- **Load Balancer:** Round Robin distribution, node failover, 503 when all down.
- **Rate Limiter:** Token Bucket refill, HTTP 429 Retry-After, IP blocklist.

---

## 2. Interactive Demo Scripts

Execute demonstration scripts while services are running (`npm run dev`):

```bash
npm run demo:roundrobin     # Demonstrates Gateway Round-Robin rotation across edges
npm run demo:cache          # Demonstrates Cache MISS vs HIT latency (HIT is faster)
npm run demo:ratelimit      # Demonstrates Token Bucket 429 Too Many Requests
npm run demo:failover       # Demonstrates Edge Node failure detection & recovery
npm run demo:invalidation   # Demonstrates automatic CDN cache purge on deploy
npm run simulate-webhook    # Sends HMAC signed push payload to local backend
```
