import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import path from 'path';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import {
  createProject,
  findProjectById,
  listProjectsByUser,
  listAllProjects,
  updateProject,
  deleteProject,
} from '../repositories/projects.repo.js';
import {
  createRepository,
  findRepositoryByProjectId,
} from '../repositories/repositories.repo.js';
import {
  createDeployment,
  findDeploymentById,
  listDeploymentsByProject,
  getDeploymentLogs,
} from '../repositories/deployments.repo.js';
import { deploymentQueue } from '../services/queue.service.js';
import { config, query, queryOne } from '@edgedeploy/shared';

const createProjectSchema = z.object({
  name: z.string().min(2),
  build_command: z.string().optional(),
  output_directory: z.string().optional(),
  install_command: z.string().optional(),
  branch: z.string().optional(),
});

const linkRepoSchema = z.object({
  repoUrl: z.string(),
  githubToken: z.string().optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function projectsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  // List projects
  fastify.get('/api/projects', async (request, reply) => {
    const user = request.user!;
    if (user.role === 'ADMIN') {
      const projects = await listAllProjects();
      return reply.send({ projects });
    } else {
      const projects = await listProjectsByUser(user.id);
      return reply.send({ projects });
    }
  });

  // Create project
  fastify.post('/api/projects', async (request, reply) => {
    const parseResult = createProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: { code: 400, message: 'Validation failed', details: parseResult.error.format() } });
    }

    const { name, build_command, output_directory, install_command, branch } = parseResult.data;
    const baseSlug = slugify(name);
    const slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

    const project = await createProject({
      user_id: request.user!.id,
      name,
      slug,
      build_command,
      output_directory,
      install_command,
      branch,
    });

    return reply.status(201).send({ project });
  });

  // Get single project
  fastify.get('/api/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    if (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    const repo = await findRepositoryByProjectId(project.id);
    return reply.send({ project, repository: repo });
  });

  // Update project
  fastify.patch('/api/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    const updated = await updateProject(projectId, request.body as any);
    return reply.send({ project: updated });
  });

  // Delete project
  fastify.delete('/api/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    await deleteProject(projectId);
    return reply.send({ message: 'Project deleted successfully' });
  });

  // Link repository
  fastify.post('/api/projects/:id/repository', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    const parseResult = linkRepoSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(422).send({ error: { code: 422, message: 'Invalid repository payload' } });
    }

    const { repoUrl } = parseResult.data;

    let owner = 'demo';
    let name = 'sample-static-site';

    if (repoUrl.startsWith('https://github.com/')) {
      const match = repoUrl.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/);
      if (!match) {
        return reply.status(422).send({ error: { code: 422, message: 'Invalid GitHub repository URL format' } });
      }
      owner = match[1];
      name = match[2];
    } else if (repoUrl.startsWith('file://') || config.security.allowLocalRepos) {
      name = path.basename(repoUrl);
    } else {
      return reply.status(422).send({ error: { code: 422, message: 'Only GitHub repository URLs (https://github.com/owner/repo) are supported' } });
    }

    const webhookSecret = crypto.randomBytes(20).toString('hex');
    const repo = await createRepository({
      project_id: project.id,
      repo_url: repoUrl,
      owner,
      name,
      default_branch: project.branch || 'main',
      webhook_id: 'wh_' + Math.random().toString(36).substring(2, 8),
      webhook_secret: webhookSecret,
    });

    return reply.status(201).send({
      repository: repo,
      warning: 'Webhook auto-registration skipped for local environment. Manual push simulation supported.',
    });
  });

  // Get project repository
  fastify.get('/api/projects/:id/repository', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    const repo = await findRepositoryByProjectId(project.id);
    return reply.send({ repository: repo });
  });

  // Trigger manual deployment
  fastify.post('/api/projects/:id/deploy', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    const commitSha = crypto.randomBytes(20).toString('hex');
    const deployment = await createDeployment({
      project_id: project.id,
      commit_sha: commitSha,
      commit_message: `Manual deployment triggered by ${request.user!.email}`,
      branch: project.branch || 'main',
      trigger: 'MANUAL',
    });

    deploymentQueue.enqueue(deployment.id);

    return reply.status(202).send({ deployment });
  });

  // Trigger redeployment
  fastify.post('/api/projects/:id/redeploy', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    const commitSha = crypto.randomBytes(20).toString('hex');
    const deployment = await createDeployment({
      project_id: project.id,
      commit_sha: commitSha,
      commit_message: `Redeployment triggered by ${request.user!.email}`,
      branch: project.branch || 'main',
      trigger: 'REDEPLOY',
    });

    deploymentQueue.enqueue(deployment.id);

    return reply.status(202).send({ deployment });
  });

  // Trigger PR / Branch preview deployment
  fastify.post('/api/projects/:id/pr-preview', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    const { prNumber = 1, branch = 'feature/preview' } = (request.body as any) || {};
    const commitSha = crypto.randomBytes(20).toString('hex');
    const deployment = await createDeployment({
      project_id: project.id,
      commit_sha: commitSha,
      commit_message: `Pull Request #${prNumber} Preview (${branch})`,
      branch: String(branch),
      pr_number: Number(prNumber),
      trigger: 'PULL_REQUEST',
    });

    deploymentQueue.enqueue(deployment.id);

    return reply.status(202).send({
      deployment,
      previewUrl: `http://localhost:8080/serve/${project.id}/pr/${prNumber}/`,
    });
  });

  // List deployments for project
  fastify.get('/api/projects/:id/deployments', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    const deployments = await listDeploymentsByProject(projectId);
    return reply.send({ deployments });
  });

  // Get deployment details
  fastify.get('/api/deployments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deploymentId = parseInt(id, 10);
    const deployment = await findDeploymentById(deploymentId);

    if (!deployment) {
      return reply.status(404).send({ error: { code: 404, message: 'Deployment not found' } });
    }

    const project = await findProjectById(deployment.project_id);
    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Deployment not found' } });
    }

    return reply.send({ deployment });
  });

  // Get deployment logs (polling endpoint)
  fastify.get('/api/deployments/:id/logs', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deploymentId = parseInt(id, 10);
    const afterSeq = parseInt((request.query as any).afterSeq || '0', 10);

    const deployment = await findDeploymentById(deploymentId);
    if (!deployment) {
      return reply.status(404).send({ error: { code: 404, message: 'Deployment not found' } });
    }

    const logs = await getDeploymentLogs(deploymentId, afterSeq);
    return reply.send({ logs, deploymentStatus: deployment.status });
  });

  // Developer project cache purge
  fastify.post('/api/projects/:id/purge-cache', async (request, reply) => {
    const { id } = request.params as { id: string };
    const projectId = parseInt(id, 10);
    const project = await findProjectById(projectId);

    if (!project || (request.user!.role !== 'ADMIN' && project.user_id !== request.user!.id)) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    for (const port of config.ports.edgePorts) {
      try {
        await fetch(`http://localhost:${port}/internal/purge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-token': config.security.internalApiToken,
          },
          body: JSON.stringify({ scope: 'project', projectId }),
        });
      } catch (err) {
        // ignore offline edge
      }
    }

    return reply.send({ message: `Cache purged successfully for project ${project.name}` });
  });

  // --- ANALYTICS ENDPOINTS ---

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
