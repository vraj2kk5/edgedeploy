import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { findProjectById } from '../repositories/projects.repo.js';
import { query, queryOne } from '@edgedeploy/shared';

export async function analyticsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  // Project Analytics Summary
  fastify.get('/api/projects/:id/analytics', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    const trafficSummary = await queryOne<{ total_requests: number; hit_count: number; miss_count: number }>(
      `SELECT 
         COUNT(*) as total_requests,
         SUM(CASE WHEN cache_result = 'HIT' THEN 1 ELSE 0 END) as hit_count,
         SUM(CASE WHEN cache_result = 'MISS' THEN 1 ELSE 0 END) as miss_count
       FROM RequestLogs WHERE project_id = ?`,
      [projectId]
    );

    const hitCount = Number(trafficSummary?.hit_count || 0);
    const missCount = Number(trafficSummary?.miss_count || 0);
    const totalCacheable = hitCount + missCount;
    const hitRatio = totalCacheable > 0 ? Number(((hitCount / totalCacheable) * 100).toFixed(2)) : 0;

    const latencyStats = await queryOne<{ avg_latency: number; min_latency: number; max_latency: number }>(
      `SELECT 
         AVG(latency_ms) as avg_latency,
         MIN(latency_ms) as min_latency,
         MAX(latency_ms) as max_latency
       FROM RequestLogs WHERE project_id = ?`,
      [projectId]
    );

    const deploymentStats = await queryOne<{ total: number; success: number; failed: number }>(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
         SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
       FROM Deployments WHERE project_id = ?`,
      [projectId]
    );

    return reply.send({
      summary: {
        totalRequests: Number(trafficSummary?.total_requests || 0),
        hitRatio,
        avgLatencyMs: Math.round(Number(latencyStats?.avg_latency || 0)),
        minLatencyMs: Number(latencyStats?.min_latency || 0),
        maxLatencyMs: Number(latencyStats?.max_latency || 0),
        deployments: {
          total: Number(deploymentStats?.total || 0),
          success: Number(deploymentStats?.success || 0),
          failed: Number(deploymentStats?.failed || 0),
        },
      },
    });
  });

  // Traffic over time (bucketed)
  fastify.get('/api/projects/:id/analytics/traffic', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    const rows = await query<{ timestamp: string; requests: number; hits: number; misses: number }>(
      `SELECT 
         DATE_FORMAT(ts, '%Y-%m-%d %H:00:00') as timestamp,
         COUNT(*) as requests,
         SUM(CASE WHEN cache_result = 'HIT' THEN 1 ELSE 0 END) as hits,
         SUM(CASE WHEN cache_result = 'MISS' THEN 1 ELSE 0 END) as misses
       FROM RequestLogs 
       WHERE project_id = ? 
       GROUP BY timestamp 
       ORDER BY timestamp ASC LIMIT 24`,
      [projectId]
    );

    return reply.send({ traffic: rows });
  });

  // Latency split by HIT vs MISS
  fastify.get('/api/projects/:id/analytics/latency', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    const hitLatency = await queryOne<{ avg: number; min: number; max: number }>(
      `SELECT AVG(latency_ms) as avg, MIN(latency_ms) as min, MAX(latency_ms) as max FROM RequestLogs WHERE project_id = ? AND cache_result = 'HIT'`,
      [projectId]
    );

    const missLatency = await queryOne<{ avg: number; min: number; max: number }>(
      `SELECT AVG(latency_ms) as avg, MIN(latency_ms) as min, MAX(latency_ms) as max FROM RequestLogs WHERE project_id = ? AND cache_result = 'MISS'`,
      [projectId]
    );

    return reply.send({
      hit: {
        avg: Math.round(Number(hitLatency?.avg || 0)),
        min: Number(hitLatency?.min || 0),
        max: Number(hitLatency?.max || 0),
      },
      miss: {
        avg: Math.round(Number(missLatency?.avg || 0)),
        min: Number(missLatency?.min || 0),
        max: Number(missLatency?.max || 0),
      },
    });
  });
}
