import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config, query, queryOne, execute, logger } from '@edgedeploy/shared';

const nodeId = process.env.NODE_ID || 'edge-1';
const port = parseInt(process.env.PORT || '4101', 10);
const region = process.env.REGION || 'Mumbai';
const cacheDir = path.resolve(config.storage.root, 'edges', nodeId);
const cacheTtlSeconds = config.cache.ttlSeconds;
const maxEntries = config.cache.maxEntries;

const app = Fastify({ logger: false });

// Local in-memory index for fast cache lookups
interface MemoryCacheItem {
  id?: number;
  fileId?: number;
  projectId: number;
  cacheKey: string;
  filePath: string;
  sizeBytes: number;
  contentType: string;
  etag: string;
  expiresAt: number;
  lastAccessedAt: number;
  hitCount: number;
}

const memoryCache = new Map<string, MemoryCacheItem>();

async function ensureCacheDirectory() {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

async function syncNodeWithDatabase() {
  await ensureCacheDirectory();
  
  // Register node status in DB
  await execute(
    `INSERT INTO EdgeNodes (name, port, region, status, cache_capacity, last_heartbeat)
     VALUES (?, ?, ?, 'HEALTHY', ?, NOW())
     ON DUPLICATE KEY UPDATE status = 'HEALTHY', last_heartbeat = NOW()`,
    [nodeId, port, region, maxEntries]
  );

  const edgeNode = await queryOne<{ id: number }>('SELECT id FROM EdgeNodes WHERE port = ?', [port]);
  if (!edgeNode) return;

  // Load active cache entries into memory
  const dbEntries = await query<any>(
    `SELECT c.*, f.content_type, f.sha256 
     FROM CacheEntries c 
     JOIN Files f ON c.file_id = f.id 
     WHERE c.edge_node_id = ? AND c.expires_at > NOW()`,
    [edgeNode.id]
  );

  for (const entry of dbEntries) {
    const safeFilename = crypto.createHash('md5').update(entry.cache_key).digest('hex');
    const diskPath = path.join(cacheDir, safeFilename);
    if (fs.existsSync(diskPath)) {
      memoryCache.set(entry.cache_key, {
        id: entry.id,
        fileId: entry.file_id,
        projectId: entry.project_id,
        cacheKey: entry.cache_key,
        filePath: diskPath,
        sizeBytes: entry.size_bytes,
        contentType: entry.content_type,
        etag: `"${entry.sha256}"`,
        expiresAt: new Date(entry.expires_at).getTime(),
        lastAccessedAt: new Date(entry.last_accessed_at).getTime(),
        hitCount: entry.hit_count,
      });
    }
  }

  logger.info(`[${nodeId}] Synced ${memoryCache.size} cache entries from database`);
}

async function evictOldestEntryIfNeeded() {
  if (memoryCache.size < maxEntries) return;

  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [key, item] of memoryCache.entries()) {
    if (item.lastAccessedAt < oldestTime) {
      oldestTime = item.lastAccessedAt;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    logger.info(`[CACHE] EVICT [EDGE] ${nodeId} Evicting entry: ${oldestKey}`);
    const item = memoryCache.get(oldestKey);
    memoryCache.delete(oldestKey);

    if (item && fs.existsSync(item.filePath)) {
      try {
        fs.unlinkSync(item.filePath);
      } catch (err) {
        // ignore
      }
    }

    const edgeNode = await queryOne<{ id: number }>('SELECT id FROM EdgeNodes WHERE port = ?', [port]);
    if (edgeNode) {
      await execute('DELETE FROM CacheEntries WHERE edge_node_id = ? AND cache_key = ?', [edgeNode.id, oldestKey]);
    }
  }
}

// Health endpoint
app.get('/health', async () => {
  await execute('UPDATE EdgeNodes SET status = "HEALTHY", last_heartbeat = NOW() WHERE port = ?', [port]);
  return { status: 'healthy', nodeId, port, region, cacheEntries: memoryCache.size, uptime: process.uptime() };
});

// Cache Purge Endpoint
app.post('/internal/purge', async (request, reply) => {
  const authHeader = request.headers['x-internal-token'];
  if (authHeader !== config.security.internalApiToken) {
    return reply.status(401).send({ error: { code: 401, message: 'Unauthorized' } });
  }

  const { scope = 'all', projectId } = (request.body as any) || {};
  let purgedCount = 0;

  const edgeNode = await queryOne<{ id: number }>('SELECT id FROM EdgeNodes WHERE port = ?', [port]);

  for (const [key, item] of Array.from(memoryCache.entries())) {
    if (scope === 'all' || (scope === 'project' && item.projectId === Number(projectId))) {
      memoryCache.delete(key);
      if (fs.existsSync(item.filePath)) {
        try {
          fs.unlinkSync(item.filePath);
        } catch (e) {}
      }
      purgedCount++;

      if (edgeNode) {
        await execute('DELETE FROM CacheEntries WHERE edge_node_id = ? AND cache_key = ?', [edgeNode.id, key]);
      }
    }
  }

  logger.info(`[${nodeId}] [PURGE] Scope: ${scope}, Project: ${projectId || 'ALL'}, Purged: ${purgedCount}`);
  return reply.send({ nodeId, scope, purgedCount });
});

// Serve site request
app.get('/serve/:projectId/*', async (request, reply) => {
  const startTime = Date.now();
  const { projectId: projIdStr } = request.params as { projectId: string };
  const projectId = parseInt(projIdStr, 10);
  const wildcardPath = (request.params as any)['*'] || '';

  const relPath = wildcardPath === '' || wildcardPath === '/' ? 'index.html' : wildcardPath;
  const cacheKey = `${projectId}:${relPath}`;

  const now = Date.now();
  const cachedItem = memoryCache.get(cacheKey);

  // Check HIT
  if (cachedItem && now < cachedItem.expiresAt) {
    cachedItem.lastAccessedAt = now;
    cachedItem.hitCount += 1;

    // Async DB update off hot path
    const edgeNode = await queryOne<{ id: number }>('SELECT id FROM EdgeNodes WHERE port = ?', [port]);
    if (edgeNode) {
      execute(
        'UPDATE CacheEntries SET last_accessed_at = NOW(), hit_count = hit_count + 1 WHERE edge_node_id = ? AND cache_key = ?',
        [edgeNode.id, cacheKey]
      ).catch(() => {});
    }

    const latency = Date.now() - startTime;
    logger.info(`[REQUEST] GET /${relPath} [EDGE] ${nodeId} [CACHE] HIT [LATENCY] ${latency}ms`);

    // Handle If-None-Match
    if (request.headers['if-none-match'] === cachedItem.etag) {
      return reply
        .status(304)
        .headers({
          'X-Cache': 'HIT',
          'X-Edge-Node': nodeId,
          ETag: cachedItem.etag,
        })
        .send();
    }

    const fileStream = fs.createReadStream(cachedItem.filePath);
    return reply
      .status(200)
      .headers({
        'Content-Type': cachedItem.contentType,
        'X-Cache': 'HIT',
        'X-Edge-Node': nodeId,
        ETag: cachedItem.etag,
        'Cache-Control': `public, max-age=${config.cache.ttlSeconds}`,
      })
      .send(fileStream);
  }

  // MISS Path: Fetch from Origin
  logger.info(`[REQUEST] GET /${relPath} [EDGE] ${nodeId} [CACHE] MISS [ORIGIN] Fetching file...`);

  try {
    const originUrl = `http://localhost:${config.ports.origin}/sites/${projectId}/${relPath}`;
    const originRes = await fetch(originUrl, {
      headers: {
        'x-internal-token': config.security.internalApiToken,
      },
    });

    if (originRes.status === 404) {
      return reply.status(404).send({ error: { code: 404, message: 'Resource not found' } });
    }

    if (!originRes.ok) {
      return reply.status(502).send({ error: { code: 502, message: 'Bad Gateway: Origin returned error' } });
    }

    const fileBuffer = Buffer.from(await originRes.arrayBuffer());
    const contentType = originRes.headers.get('content-type') || 'text/html';
    const etag = originRes.headers.get('etag') || `"${now}"`;

    await evictOldestEntryIfNeeded();

    const safeFilename = crypto.createHash('md5').update(cacheKey).digest('hex');
    const diskPath = path.join(cacheDir, safeFilename);
    fs.writeFileSync(diskPath, fileBuffer);

    const expiresAt = now + cacheTtlSeconds * 1000;
    const memoryItem: MemoryCacheItem = {
      projectId,
      cacheKey,
      filePath: diskPath,
      sizeBytes: fileBuffer.length,
      contentType,
      etag,
      expiresAt,
      lastAccessedAt: now,
      hitCount: 1,
    };

    memoryCache.set(cacheKey, memoryItem);

    // Save to CacheEntries DB table
    const edgeNode = await queryOne<{ id: number }>('SELECT id FROM EdgeNodes WHERE port = ?', [port]);
    if (edgeNode) {
      const activeDep = await queryOne<{ active_deployment_id: number }>(
        'SELECT active_deployment_id FROM Projects WHERE id = ?',
        [projectId]
      );
      if (activeDep?.active_deployment_id) {
        const fileRow = await queryOne<{ id: number }>(
          'SELECT id FROM Files WHERE deployment_id = ? AND path = ?',
          [activeDep.active_deployment_id, relPath]
        );
        if (fileRow) {
          execute(
            `INSERT INTO CacheEntries (edge_node_id, file_id, project_id, cache_key, size_bytes, ttl_seconds, expires_at, last_accessed_at, hit_count)
             VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?), 1)
             ON DUPLICATE KEY UPDATE 
               size_bytes = VALUES(size_bytes),
               expires_at = VALUES(expires_at),
               last_accessed_at = VALUES(last_accessed_at),
               hit_count = hit_count + 1`,
            [
              edgeNode.id,
              fileRow.id,
              projectId,
              cacheKey,
              fileBuffer.length,
              cacheTtlSeconds,
              Math.floor(expiresAt / 1000),
              Math.floor(now / 1000),
            ]
          ).catch((e) => logger.warn(`[${nodeId}] Failed DB CacheEntry record: ${e.message}`));
        }
      }
    }

    const latency = Date.now() - startTime;
    logger.info(`[CACHE] Stored [EDGE] ${nodeId} Key: ${cacheKey} [LATENCY] ${latency}ms`);

    return reply
      .status(200)
      .headers({
        'Content-Type': contentType,
        'X-Cache': 'MISS',
        'X-Edge-Node': nodeId,
        ETag: etag,
        'Cache-Control': `public, max-age=${cacheTtlSeconds}`,
      })
      .send(fileBuffer);
  } catch (err: any) {
    logger.error(`[${nodeId}] Origin fetch error: ${err.message}`);
    return reply.status(502).send({ error: { code: 502, message: 'Bad Gateway: Could not reach Origin server' } });
  }
});

async function start() {
  await syncNodeWithDatabase();
  try {
    await app.listen({ port, host: '0.0.0.0' });
    logger.info(`🌐 [Edge Node: ${nodeId}] Listening on http://localhost:${port} (Region: ${region})`);
  } catch (err: any) {
    logger.error(`Failed to start Edge Node ${nodeId}:`, err);
    process.exit(1);
  }
}

start();
