# EdgeDeploy API Specification

All REST API endpoints return JSON formatted responses:
`{ "data": ... }` or `{ "error": { "code": number, "message": string } }`

---

## 1. Authentication Endpoints

### `POST /api/auth/signup`
- **Request Body:** `{ "email": "user@example.com", "password": "Password123!" }`
- **Response (201):** `{ "user": { "id": 1, "email": "user@example.com", "role": "DEVELOPER" }, "token": "<jwt_token>" }`
- **Response (409):** Email already exists.

### `POST /api/auth/login`
- **Request Body:** `{ "email": "user@example.com", "password": "Password123!" }`
- **Response (200):** `{ "user": ..., "token": "<jwt_token>" }`
- **Response (403):** Account is blocked.

### `GET /api/auth/me`
- **Header:** `Authorization: Bearer <jwt_token>`
- **Response (200):** `{ "user": ... }`

---

## 2. Project & Repository Endpoints

### `GET /api/projects`
- **Response (200):** `{ "projects": [...] }`

### `POST /api/projects`
- **Request Body:** `{ "name": "My App", "build_command": "npm run build", "output_directory": "dist", "branch": "main" }`
- **Response (201):** `{ "project": ... }`

### `POST /api/projects/:id/repository`
- **Request Body:** `{ "repoUrl": "https://github.com/owner/repo" }`
- **Response (201):** `{ "repository": ... }`

### `POST /api/projects/:id/deploy`
- **Response (202):** `{ "deployment": { "id": 2, "status": "QUEUED" } }`

### `GET /api/deployments/:id/logs?afterSeq=0`
- **Response (200):** `{ "logs": [...], "deploymentStatus": "BUILDING" }`

---

## 3. GitHub Webhook Endpoint

### `POST /api/webhooks/github`
- **Headers:** `X-GitHub-Event: push`, `X-Hub-Signature-256: sha256=<hmac>`
- **Response (202):** `{ "message": "Webhook received and deployment queued", "deploymentId": 5 }`

---

## 4. Admin Endpoints (Requires ADMIN Role)

### `GET /api/admin/overview`
- **Response (200):** Global stats, deployment counts, global hit ratio.

### `PATCH /api/admin/users/:id/block`
- **Response (200):** `{ "message": "User blocked successfully" }`

### `POST /api/admin/cache/purge`
- **Request Body:** `{ "scope": "all" | "project", "projectId": 1 }`
- **Response (200):** `{ "purgedCount": 15 }`
