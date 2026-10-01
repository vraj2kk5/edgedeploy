import Fastify from 'fastify';
import fs from 'fs';
import path from 'path';
import { config, queryOne, logger } from '@edgedeploy/shared';

const app = Fastify({ logger: false });

// In-memory cache for project active deployment IDs (TTL 5s)
const activeDeploymentCache = new Map<number, { deploymentId: number | null; timestamp: number }>();

async function getActiveDeploymentId(projectId: number): Promise<number | null> {
  const cached = activeDeploymentCache.get(projectId);
  if (cached && Date.now() - cached.timestamp < 5000) {
    return cached.deploymentId;
  }

  const project = await queryOne<{ active_deployment_id: number | null }>(
    'SELECT active_deployment_id FROM Projects WHERE id = ?',
    [projectId]
  );

  const activeId = project?.active_deployment_id || null;
  activeDeploymentCache.set(projectId, { deploymentId: activeId, timestamp: Date.now() });
  return activeId;
}

// Health check
app.get('/health', async () => {
  return { status: 'healthy', service: 'origin', timestamp: new Date().toISOString() };
});

// Root welcome route
app.get('/', async () => {
  return {
    service: 'EdgeDeploy Origin Storage Server',
    status: 'online',
    port: config.ports.origin,
    health: 'http://localhost:4000/health'
  };
});

// Serve site static files
app.get('/sites/:projectId/*', async (request, reply) => {
  const authHeader = request.headers['x-internal-token'];
  if (authHeader !== config.security.internalApiToken) {
    return reply.status(401).send({ error: { code: 401, message: 'Unauthorized internal service request' } });
  }

  const { projectId: projIdStr } = request.params as { projectId: string };
  const projectId = parseInt(projIdStr, 10);
  const wildcardPath = (request.params as any)['*'] || '';

  if (isNaN(projectId)) {
    return reply.status(400).send({ error: { code: 400, message: 'Invalid project ID' } });
  }

  // Path traversal guard
  if (wildcardPath.includes('..') || wildcardPath.includes('\0') || wildcardPath.startsWith('/')) {
    return reply.status(400).send({ error: { code: 400, message: 'Path traversal attempt rejected' } });
  }

  const customDepId = request.headers['x-deployment-id'] ? parseInt(request.headers['x-deployment-id'] as string, 10) : null;
  const activeDeploymentId = customDepId || await getActiveDeploymentId(projectId);
  if (!activeDeploymentId) {
    return reply.status(404).send({ error: { code: 404, message: 'No active deployment for this project' } });
  }

  const relPath = wildcardPath === '' || wildcardPath === '/' ? 'index.html' : wildcardPath;
  const originRootDir = path.resolve(config.storage.root, 'origin', String(projectId), String(activeDeploymentId));
  const filePath = path.resolve(originRootDir, relPath);

  // Security guard: verify filePath is strictly inside originRootDir
  if (!filePath.startsWith(originRootDir)) {
    return reply.status(400).send({ error: { code: 400, message: 'Path traversal forbidden' } });
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return reply.status(404).send({ error: { code: 404, message: 'File not found' } });
  }

  const fileRecord = await queryOne<{ sha256: string; content_type: string }>(
    'SELECT sha256, content_type FROM Files WHERE deployment_id = ? AND path = ?',
    [activeDeploymentId, relPath]
  );

  const etag = fileRecord?.sha256 ? `"${fileRecord.sha256}"` : `"${fs.statSync(filePath).mtimeMs}"`;
  const contentType = fileRecord?.content_type || 'text/html';

  // Support If-None-Match 304
  const clientEtag = request.headers['if-none-match'];
  if (clientEtag && clientEtag === etag) {
    return reply
      .status(304)
      .headers({
        ETag: etag,
        'X-Deployment-Id': String(activeDeploymentId),
      })
      .send();
  }

  const fileStream = fs.createReadStream(filePath);

  return reply
    .status(200)
    .headers({
      'Content-Type': contentType,
      ETag: etag,
      'X-Deployment-Id': String(activeDeploymentId),
      'Cache-Control': 'public, max-age=60',
    })
    .send(fileStream);
});

async function start() {
  const port = config.ports.origin;
  try {
    await app.listen({ port, host: '0.0.0.0' });
    logger.info(`🏛️ [Origin Server] Running on http://localhost:${port}`);
  } catch (err: any) {
    logger.error('Failed to start Origin server:', err);
    process.exit(1);
  }
}

start();
