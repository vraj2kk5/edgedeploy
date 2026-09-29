# System Limitations & Scope Boundaries (docs/LIMITATIONS.md)

In accordance with SRS §2.4, §7.2, and academic course guidelines (GSFC University, AWT course), **EdgeDeploy** is explicitly designed as a simulated edge hosting platform for academic instruction. The following production technologies and features are intentionally excluded and documented as limitations:

---

## 1. Excluded Architecture & Infrastructure Technologies
1. **No Docker / Containers / Kubernetes / Swarm:** All processes (backend, origin, gateway, edge nodes) run as plain Node.js processes on host operating system.
2. **No Serverless / Edge Functions:** Hosted sites are strictly static HTML, CSS, JavaScript, and asset media files. No dynamic SSR (Node/PHP/Python) or database execution inside deployed user sites.
3. **No Anycast / Real Multi-Region DNS:** Edge nodes are simulated independent Node.js processes running on localhost ports (`:4101`, `:4102`, `:4103`). Region labels ("Mumbai", "Ahmedabad", "Delhi") are simulated labels passed via environment variables.
4. **No Production Sandboxing:** Build subprocess execution runs in isolated filesystem directories with scrubbed environment variables and process timeouts, but does not use cgroups or Linux kernel namespaces.
5. **No Redis or Distributed Databases:** Rate limiting state, load balancing health tables, and cache entry indexes are managed in-memory with raw MySQL database persistence.
6. **No Automated SSL / DNS Management:** Domains are mapped to `<slug>.localhost` without automated Let's Encrypt certificate issuance.

---

## 2. Academic Viva Defense Notes
- **Static Site Hosting Only:** Demonstrates CI/CD deployment pipelines, static file hashing (SHA-256), ETag caching, and CDN proxying without server-side app hosting overhead.
- **Relational Integrity over ORM:** Demonstrates parameterized raw SQL queries (`mysql2/promise`) and foreign key constraints without ORM abstraction layers.
