import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth.js';
import { query, queryOne, execute, config } from '@edgedeploy/shared';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole('ADMIN'));

  // Admin Overview Stats
  fastify.get('/api/admin/overview', async (request, reply) => {
    const userCount = await queryOne<{ total: number }>('SELECT COUNT(*) as total FROM Users');
    const projectCount = await queryOne<{ total: number }>('SELECT COUNT(*) as total FROM Projects');
    const deploymentStats = await queryOne<{ total: number; success: number; failed: number }>(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
         SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
       FROM Deployments`
    );
    const requestStats = await queryOne<{ total: number; hits: number; misses: number; avg_latency: number }>(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN cache_result = 'HIT' THEN 1 ELSE 0 END) as hits,
         SUM(CASE WHEN cache_result = 'MISS' THEN 1 ELSE 0 END) as misses,
         AVG(latency_ms) as avg_latency
       FROM RequestLogs`
    );

    const hits = Number(requestStats?.hits || 0);
    const misses = Number(requestStats?.misses || 0);
    const totalCacheable = hits + misses;
    const globalHitRatio = totalCacheable > 0 ? Number(((hits / totalCacheable) * 100).toFixed(2)) : 0;

    return reply.send({
      overview: {
        totalUsers: Number(userCount?.total || 0),
        totalProjects: Number(projectCount?.total || 0),
        deployments: {
          total: Number(deploymentStats?.total || 0),
          success: Number(deploymentStats?.success || 0),
          failed: Number(deploymentStats?.failed || 0),
        },
        requests: {
          total: Number(requestStats?.total || 0),
          globalHitRatio,
          avgLatencyMs: Math.round(Number(requestStats?.avg_latency || 0)),
        },
      },
    });
  });

  // Admin Projects list
  fastify.get('/api/admin/projects', async (request, reply) => {
    const projects = await query(`
      SELECT p.*, u.email as owner_email, d.hostname as primary_domain
      FROM Projects p
      JOIN Users u ON p.user_id = u.id
      LEFT JOIN Domains d ON p.id = d.project_id AND d.is_primary = TRUE
      ORDER BY p.created_at DESC
    `);
    return reply.send({ projects });
  });

  // Admin Deployments list
  fastify.get('/api/admin/deployments', async (request, reply) => {
    const deployments = await query(`
      SELECT d.*, p.name as project_name, p.slug as project_slug
      FROM Deployments d
      JOIN Projects p ON d.project_id = p.id
      ORDER BY d.created_at DESC LIMIT 50
    `);
    return reply.send({ deployments });
  });

  // Admin Edges status & details
  fastify.get('/api/admin/edges', async (request, reply) => {
    const edges = await query(`
      SELECT e.*, 
        (SELECT COUNT(*) FROM CacheEntries c WHERE c.edge_node_id = e.id) as current_cache_entries
      FROM EdgeNodes e ORDER BY e.id ASC
    `);
    return reply.send({ edges });
  });

  // Admin Edges health live probe
  fastify.get('/api/admin/health', async (request, reply) => {
    const edges = await query('SELECT * FROM EdgeNodes ORDER BY id ASC');
    const healthResults = await Promise.all(
      edges.map(async (edge: any) => {
        try {
          const res = await fetch(`http://localhost:${edge.port}/health`, { signal: AbortSignal.timeout(2000) });
          if (res.ok) {
            const data: any = await res.json();
            return { id: edge.id, name: edge.name, port: edge.port, region: edge.region, status: 'HEALTHY', details: data };
          }
          return { id: edge.id, name: edge.name, port: edge.port, region: edge.region, status: 'UNHEALTHY', details: null };
        } catch (err) {
          return { id: edge.id, name: edge.name, port: edge.port, region: edge.region, status: 'OFFLINE', details: null };
        }
      })
    );
    return reply.send({ health: healthResults });
  });

  // Global Admin Purge Cache
  fastify.post('/api/admin/cache/purge', async (request, reply) => {
    const { scope = 'all', projectId } = (request.body as any) || {};

    let purgedCount = 0;
    for (const port of config.ports.edgePorts) {
      try {
        const res = await fetch(`http://localhost:${port}/internal/purge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-token': config.security.internalApiToken,
          },
          body: JSON.stringify({ scope, projectId }),
        });
        if (res.ok) {
          const data: any = await res.json();
          purgedCount += data.purgedCount || 0;
        }
      } catch (err) {
        // ignore offline edge
      }
    }

    return reply.send({ message: `Cache purge triggered across all edge nodes`, scope, purgedCount });
  });

  // Admin Rate Limits list
  fastify.get('/api/admin/rate-limits', async (request, reply) => {
    const rateLimits = await query('SELECT * FROM RateLimits ORDER BY is_blocked DESC, request_count DESC LIMIT 50');
    return reply.send({ rateLimits });
  });

  // Admin Block IP
  fastify.post('/api/admin/rate-limits/block', async (request, reply) => {
    const { ip, reason = 'Blocked by Admin' } = request.body as { ip: string; reason?: string };

    if (!ip) {
      return reply.status(400).send({ error: { code: 400, message: 'IP address is required' } });
    }

    await execute(
      `INSERT INTO RateLimits (client_ip, is_blocked, block_reason, blocked_by)
       VALUES (?, TRUE, ?, 'ADMIN')
       ON DUPLICATE KEY UPDATE is_blocked = TRUE, block_reason = VALUES(block_reason), blocked_by = 'ADMIN'`,
      [ip, reason]
    );

    return reply.send({ message: `IP ${ip} has been blocked successfully` });
  });

  // Admin Unblock IP
  fastify.post('/api/admin/rate-limits/unblock', async (request, reply) => {
    const { ip } = request.body as { ip: string };

    if (!ip) {
      return reply.status(400).send({ error: { code: 400, message: 'IP address is required' } });
    }

    await execute(
      `UPDATE RateLimits SET is_blocked = FALSE, tokens = 10, block_reason = NULL, blocked_by = NULL WHERE client_ip = ?`,
      [ip]
    );

    return reply.send({ message: `IP ${ip} has been unblocked successfully` });
  });

  // Admin Request Logs Inspector
  fastify.get('/api/admin/request-logs', async (request, reply) => {
    const { status, cache, search } = request.query as { status?: string; cache?: string; search?: string };
    
    let whereConditions: string[] = [];
    let params: any[] = [];

    if (status && status !== 'ALL') {
      whereConditions.push('r.status_code = ?');
      params.push(parseInt(status, 10));
    }
    if (cache && cache !== 'ALL') {
      whereConditions.push('r.cache_result = ?');
      params.push(cache);
    }
    if (search && search.trim() !== '') {
      whereConditions.push('(r.client_ip LIKE ? OR r.path LIKE ? OR r.domain LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const logs = await query(`
      SELECT 
        r.id, r.ts, r.client_ip, r.project_id, r.domain, r.path, r.method,
        r.status_code, r.latency_ms, r.edge_node_id, r.cache_result, r.bytes,
        p.name as project_name,
        e.name as edge_name, e.region as edge_region
      FROM RequestLogs r
      LEFT JOIN Projects p ON r.project_id = p.id
      LEFT JOIN EdgeNodes e ON r.edge_node_id = e.id
      ${whereClause}
      ORDER BY r.ts DESC LIMIT 100
    `, params);

    const stats = await queryOne<{ total: number; success_count: number; rate_limited: number; avg_latency: number }>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status_code = 429 THEN 1 ELSE 0 END) as rate_limited,
        AVG(latency_ms) as avg_latency
      FROM RequestLogs
    `);

    return reply.send({
      logs,
      stats: {
        total: Number(stats?.total || 0),
        success: Number(stats?.success_count || 0),
        rateLimited: Number(stats?.rate_limited || 0),
        avgLatencyMs: Math.round(Number(stats?.avg_latency || 0)),
      }
    });
  });
}
