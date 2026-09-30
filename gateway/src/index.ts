import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config, query, queryOne, execute, logger, RequestLog } from '@edgedeploy/shared';

const app = Fastify({ logger: false });

// -------------------------------------------------------------
// 1. TOKEN BUCKET RATE LIMITER (In-Memory State + Async DB Flush)
// -------------------------------------------------------------
interface TokenBucket {
  tokens: number;
  lastRefill: number;
  isBlocked: boolean;
  blockReason?: string;
}

const rateLimitBuckets = new Map<string, TokenBucket>();

// Pre-load blocked IPs from DB
async function syncRateLimitsWithDB() {
  const rows = await query<any>('SELECT client_ip, is_blocked, block_reason FROM RateLimits WHERE is_blocked = TRUE');
  for (const r of rows) {
    rateLimitBuckets.set(r.client_ip, {
      tokens: 0,
      lastRefill: Date.now(),
      isBlocked: true,
      blockReason: r.block_reason || 'Blocked by Admin',
    });
  }
}

function checkRateLimit(clientIp: string): { allowed: boolean; retryAfterSeconds: number; isBlocked: boolean; reason?: string } {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(clientIp);

  if (!bucket) {
    bucket = {
      tokens: config.rateLimit.capacity,
      lastRefill: now,
      isBlocked: false,
    };
    rateLimitBuckets.set(clientIp, bucket);
  }

  if (bucket.isBlocked) {
    return { allowed: false, retryAfterSeconds: 3600, isBlocked: true, reason: bucket.blockReason || 'IP address blocked' };
  }

  // Refill tokens
  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(config.rateLimit.capacity, bucket.tokens + elapsedSec * config.rateLimit.refillPerSec);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfterSeconds: 0, isBlocked: false };
  } else {
    const needed = 1 - bucket.tokens;
    const retryAfter = Math.ceil(needed / config.rateLimit.refillPerSec);
    logger.warn(`[RATE_LIMIT] IP blocked ${clientIp} [RETRY_AFTER] ${retryAfter}s`);

    // Record offender in DB asynchronously
    execute(
      `INSERT INTO RateLimits (client_ip, tokens, window_start, request_count, is_blocked, block_reason, blocked_by)
       VALUES (?, ?, NOW(), 1, FALSE, 'Rate limit exceeded', 'AUTO')
       ON DUPLICATE KEY UPDATE request_count = request_count + 1, tokens = ?`,
      [clientIp, bucket.tokens, bucket.tokens]
    ).catch(() => {});

    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter), isBlocked: false, reason: 'Too many requests' };
  }
}

// -------------------------------------------------------------
// 2. HEALTH CHECKER & ROUND-ROBIN LOAD BALANCER
// -------------------------------------------------------------
interface NodeState {
  id: number;
  name: string;
  port: number;
  region: string;
  status: 'HEALTHY' | 'UNHEALTHY' | 'OFFLINE';
  consecutiveFailures: number;
}

let edgeNodePool: NodeState[] = [];
let roundRobinIndex = 0;

async function loadEdgeNodes() {
  const nodes = await query<any>('SELECT * FROM EdgeNodes ORDER BY id ASC');
  edgeNodePool = nodes.map((n) => ({
    id: n.id,
    name: n.name,
    port: n.port,
    region: n.region,
    status: n.status || 'HEALTHY',
    consecutiveFailures: 0,
  }));
}

async function startHealthCheckLoop() {
  setInterval(async () => {
    for (const node of edgeNodePool) {
      try {
        const res = await fetch(`http://localhost:${node.port}/health`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          if (node.status !== 'HEALTHY') {
            logger.info(`[HEALTH CHECK] Edge Node ${node.name} (${node.port}) recovered -> HEALTHY`);
            node.status = 'HEALTHY';
            execute('UPDATE EdgeNodes SET status = "HEALTHY" WHERE id = ?', [node.id]).catch(() => {});
          }
          node.consecutiveFailures = 0;
        } else {
          node.consecutiveFailures++;
          if (node.consecutiveFailures >= 2 && node.status === 'HEALTHY') {
            logger.warn(`[HEALTH CHECK] Edge Node ${node.name} (${node.port}) health check failed -> UNHEALTHY`);
            node.status = 'UNHEALTHY';
            execute('UPDATE EdgeNodes SET status = "UNHEALTHY" WHERE id = ?', [node.id]).catch(() => {});
          }
        }
      } catch (err) {
        node.consecutiveFailures++;
        if (node.consecutiveFailures >= 2 && node.status !== 'OFFLINE') {
          logger.warn(`[HEALTH CHECK] Edge Node ${node.name} (${node.port}) unreachable -> OFFLINE`);
          node.status = 'OFFLINE';
          execute('UPDATE EdgeNodes SET status = "OFFLINE" WHERE id = ?', [node.id]).catch(() => {});
        }
      }
    }
  }, config.gateway.healthIntervalMs);
}

function selectEdgeNode(preferredRegion?: string): NodeState | null {
  const healthyNodes = edgeNodePool.filter((n) => n.status === 'HEALTHY');
  if (healthyNodes.length === 0) return null;

  // Region preference check
  if (preferredRegion) {
    const regionMatch = healthyNodes.find((n) => n.region.toLowerCase() === preferredRegion.toLowerCase());
    if (regionMatch) return regionMatch;
  }

  // Round Robin
  const selected = healthyNodes[roundRobinIndex % healthyNodes.length];
  roundRobinIndex = (roundRobinIndex + 1) % healthyNodes.length;
  return selected;
}

// -------------------------------------------------------------
// 3. ASYNC REQUEST LOGGER BATCHER
// -------------------------------------------------------------
const logBuffer: Omit<RequestLog, 'id'>[] = [];

function bufferRequestLog(log: Omit<RequestLog, 'id'>) {
  logBuffer.push(log);
  if (logBuffer.length >= 10) {
    flushRequestLogs();
  }
}

async function flushRequestLogs() {
  if (logBuffer.length === 0) return;
  const items = [...logBuffer];
  logBuffer.length = 0;

  for (const item of items) {
    execute(
      `INSERT INTO RequestLogs (ts, client_ip, project_id, domain, path, method, status_code, latency_ms, edge_node_id, cache_result, bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.ts,
        item.client_ip,
        item.project_id,
        item.domain,
        item.path,
        item.method,
        item.status_code,
        item.latency_ms,
        item.edge_node_id,
        item.cache_result,
        item.bytes,
      ]
    ).catch(() => {});
  }
}

setInterval(flushRequestLogs, 3000);

// -------------------------------------------------------------
// 4. GATEWAY REQUEST PIPELINE ROUTER
// -------------------------------------------------------------
app.register(cors, { origin: true });

app.get('/health', async () => {
  return { status: 'healthy', service: 'gateway', healthyEdges: edgeNodePool.filter((n) => n.status === 'HEALTHY').length };
});

// Proxy HTTP routes explicitly (excluding OPTIONS to avoid cors plugin collision)
app.route({
  method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'],
  url: '*',
  handler: async (request, reply) => {
    const startTime = Date.now();
    const clientIp = (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || request.ip || '127.0.0.1';

    // Step 1: TOKEN BUCKET RATE LIMITER (Runs First)
    const rlResult = checkRateLimit(clientIp);
    if (!rlResult.allowed) {
      bufferRequestLog({
        ts: new Date(),
        client_ip: clientIp,
        project_id: null,
        domain: request.headers.host || 'localhost',
        path: request.url,
        method: request.method,
        status_code: 429,
        latency_ms: Date.now() - startTime,
        edge_node_id: null,
        cache_result: 'NONE',
        bytes: 0,
      });

      return reply
        .status(429)
        .headers({
          'Retry-After': String(rlResult.retryAfterSeconds),
        })
        .send({
          error: {
            code: 429,
            message: `Too many requests. Retry in ${rlResult.retryAfterSeconds} seconds.`,
            reason: rlResult.reason,
          },
        });
    }

    // Step 2: PROJECT RESOLUTION (by Host header or path prefix)
    const host = request.headers.host || '';
    let projectId: number | null = null;
    let domainName = host;
    let targetPath = request.url;

    // Check if root '/' requested on Gateway directly
    if (request.url === '/' || request.url === '') {
      return reply.status(200).send({
        service: 'EdgeDeploy Gateway Load Balancer',
        status: 'online',
        port: config.ports.gateway,
        healthyEdges: edgeNodePool.filter((n) => n.status === 'HEALTHY').length,
        usage: 'Access deployed sites via http://localhost:8080/serve/:projectId/ or http://<slug>.localhost:8080/',
        dashboard: 'http://localhost:3000',
        healthCheck: 'http://localhost:8080/health'
      });
    }

    // Path prefix fallback: /_site/<slugOrId>/... or /site/<slugOrId>/... or /serve/<slugOrId>/...
    const pathPrefixMatch = request.url.match(/^\/(_site|site|serve)\/([^\/]+)(.*)$/);
    if (pathPrefixMatch) {
      const slugOrId = pathPrefixMatch[2];
      targetPath = pathPrefixMatch[3] || '/';
      
      if (/^\d+$/.test(slugOrId)) {
        const proj = await queryOne<{ id: number; slug: string }>('SELECT id, slug FROM Projects WHERE id = ?', [parseInt(slugOrId, 10)]);
        if (proj) {
          projectId = proj.id;
          domainName = `${proj.slug}.localhost`;
        }
      } else {
        const proj = await queryOne<{ id: number }>('SELECT id FROM Projects WHERE slug = ?', [slugOrId]);
        if (proj) {
          projectId = proj.id;
          domainName = `${slugOrId}.localhost`;
        }
      }
    } else {
      // Domain Host resolution: <slug>.localhost:8080
      const hostname = host.split(':')[0];
      const domainRow = await queryOne<{ project_id: number }>('SELECT project_id FROM Domains WHERE hostname = ?', [hostname]);
      if (domainRow) {
        projectId = domainRow.project_id;
      } else {
        // Slug prefix attempt
        const slugCandidate = hostname.split('.')[0];
        const proj = await queryOne<{ id: number }>('SELECT id FROM Projects WHERE slug = ?', [slugCandidate]);
        if (proj) {
          projectId = proj.id;
        }
      }
    }

    if (!projectId) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found for host/path' } });
    }

    // Step 3: LOAD BALANCER & EDGE PROXY
    const preferredRegion = request.headers['x-edge-region'] as string | undefined;
    let edgeNode = selectEdgeNode(preferredRegion);

    if (!edgeNode) {
      return reply.status(503).send({ error: { code: 503, message: 'Service Unavailable: No healthy edge nodes available' } });
    }

    const cleanPath = targetPath === '' || targetPath === '/' ? 'index.html' : targetPath.replace(/^\//, '');
    let edgeUrl = `http://localhost:${edgeNode.port}/serve/${projectId}/${cleanPath}`;

    try {
      let edgeRes = await fetch(edgeUrl, {
        method: request.method,
        headers: {
          'if-none-match': request.headers['if-none-match'] || '',
        },
      });

      // Retry once on another edge node if edge fails mid-request
      if (!edgeRes.ok && edgeRes.status >= 500) {
        edgeNode.status = 'UNHEALTHY';
        const fallbackNode = selectEdgeNode();
        if (fallbackNode) {
          edgeNode = fallbackNode;
          edgeUrl = `http://localhost:${edgeNode.port}/serve/${projectId}/${cleanPath}`;
          edgeRes = await fetch(edgeUrl, {
            method: request.method,
            headers: {
              'if-none-match': request.headers['if-none-match'] || '',
            },
          });
        }
      }

      const cacheResult = (edgeRes.headers.get('x-cache') as any) || 'NONE';
      const etag = edgeRes.headers.get('etag') || '';
      const contentType = edgeRes.headers.get('content-type') || 'text/html';

      const bodyBuffer = Buffer.from(await edgeRes.arrayBuffer());

      bufferRequestLog({
        ts: new Date(),
        client_ip: clientIp,
        project_id: projectId,
        domain: domainName,
        path: cleanPath,
        method: request.method,
        status_code: edgeRes.status,
        latency_ms: Date.now() - startTime,
        edge_node_id: edgeNode.id,
        cache_result: cacheResult,
        bytes: bodyBuffer.length,
      });

      return reply
        .status(edgeRes.status)
        .headers({
          'Content-Type': contentType,
          'X-Cache': cacheResult,
          'X-Edge-Node': edgeNode.name,
          'X-Served-By': `EdgeDeploy-Gateway (${edgeNode.name}:${edgeNode.region})`,
          ETag: etag,
          'Cache-Control': edgeRes.headers.get('cache-control') || 'public, max-age=60',
        })
        .send(bodyBuffer);
    } catch (err: any) {
      logger.error(`[Gateway] Error proxying to edge ${edgeNode.name}:${edgeNode.port}: ${err.message}`);
      return reply.status(502).send({ error: { code: 502, message: 'Bad Gateway: Proxy to edge node failed' } });
    }
  },
});

async function start() {
  await syncRateLimitsWithDB();
  await loadEdgeNodes();
  startHealthCheckLoop();

  const port = config.ports.gateway;
  try {
    await app.listen({ port, host: '0.0.0.0' });
    logger.info(`🚪 [Gateway Load Balancer] Running on http://localhost:${port}`);
  } catch (err: any) {
    logger.error('Failed to start Gateway:', err);
    process.exit(1);
  }
}

start();
