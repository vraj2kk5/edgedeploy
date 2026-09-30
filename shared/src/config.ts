import dotenv from 'dotenv';
import path from 'path';

// Load .env from root directory if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

// Determine root directory regardless of workspace working directory
const monorepoRoot = path.resolve(__dirname, '..', '..');

export const config = {
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'edgedeploy',
    connectionLimit: 10,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'super_secret_jwt_key_edgedeploy_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@edgedeploy.local',
    password: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
  },
  ports: {
    backend: parseInt(process.env.BACKEND_PORT || '3001', 10),
    origin: parseInt(process.env.ORIGIN_PORT || '4000', 10),
    gateway: parseInt(process.env.GATEWAY_PORT || '8080', 10),
    edgePorts: (process.env.EDGE_NODE_PORTS || '4101,4102,4103')
      .split(',')
      .map((p) => parseInt(p.trim(), 10)),
    edgeRegions: (process.env.EDGE_REGIONS || 'Mumbai,Ahmedabad,Delhi')
      .split(',')
      .map((r) => r.trim()),
  },
  security: {
    internalApiToken: process.env.INTERNAL_API_TOKEN || 'internal_secret_token_edgedeploy_8832',
    allowLocalRepos: process.env.ALLOW_LOCAL_REPOS === 'true',
    trustProxy: process.env.TRUST_PROXY === 'true',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    publicWebhookUrl: process.env.PUBLIC_WEBHOOK_URL || 'http://localhost:3001',
  },
  storage: {
    root: path.resolve(monorepoRoot, process.env.STORAGE_PATH || './storage'),
  },
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '60', 10),
    maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '100', 10),
  },
  rateLimit: {
    windowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW || '60', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
    capacity: parseInt(process.env.RATE_LIMIT_CAPACITY || '10', 10),
    refillPerSec: parseFloat(process.env.RATE_LIMIT_REFILL_PER_SEC || '2'),
  },
  build: {
    timeoutMs: parseInt(process.env.BUILD_TIMEOUT_MS || '300000', 10),
    maxLogBytes: parseInt(process.env.MAX_LOG_BYTES || '1048576', 10),
    concurrency: parseInt(process.env.BUILD_CONCURRENCY || '2', 10),
    keepDeployments: parseInt(process.env.KEEP_DEPLOYMENTS || '5', 10),
  },
  gateway: {
    healthIntervalMs: parseInt(process.env.HEALTH_INTERVAL_MS || '5000', 10),
  },
};
