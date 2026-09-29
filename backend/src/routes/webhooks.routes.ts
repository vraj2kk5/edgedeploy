import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { findRepositoryByOwnerAndName } from '../repositories/repositories.repo.js';
import { findProjectById } from '../repositories/projects.repo.js';
import { createDeployment } from '../repositories/deployments.repo.js';
import { deploymentQueue } from '../services/queue.service.js';
import { findUserById } from '../repositories/users.repo.js';

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/webhooks/github', async (request, reply) => {
    const event = request.headers['x-github-event'];
    if (event === 'ping') {
      return reply.status(200).send({ message: 'pong' });
    }

    if (event !== 'push') {
      return reply.status(200).send({ message: `Ignored event: ${event}` });
    }

    const rawBody = (request as any).rawBody || JSON.stringify(request.body);
    const signature = request.headers['x-hub-signature-256'] as string;

    const payload = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (!payload || !payload.repository) {
      return reply.status(400).send({ error: { code: 400, message: 'Invalid payload' } });
    }

    const owner = payload.repository.owner?.name || payload.repository.owner?.login;
    const name = payload.repository.name;

    const repo = await findRepositoryByOwnerAndName(owner, name);
    if (!repo) {
      return reply.status(404).send({ error: { code: 404, message: 'Repository not linked to any project' } });
    }

    // Verify Signature if webhook secret exists
    if (repo.webhook_secret && signature) {
      const hmac = crypto.createHmac('sha256', repo.webhook_secret);
      const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
      try {
        const sigBuffer = Buffer.from(signature);
        const digestBuffer = Buffer.from(digest);
        if (sigBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(sigBuffer, digestBuffer)) {
          return reply.status(401).send({ error: { code: 401, message: 'Invalid webhook signature' } });
        }
      } catch (err) {
        return reply.status(401).send({ error: { code: 401, message: 'Invalid webhook signature' } });
      }
    }

    // Check project and owner status
    const project = await findProjectById(repo.project_id);
    if (!project) {
      return reply.status(404).send({ error: { code: 404, message: 'Project not found' } });
    }

    const ownerUser = await findUserById(project.user_id);
    if (ownerUser?.is_blocked) {
      return reply.status(403).send({ error: { code: 403, message: 'Project owner account is blocked' } });
    }

    // Check branch match (ref e.g. "refs/heads/main")
    const pushBranch = payload.ref ? payload.ref.replace('refs/heads/', '') : 'main';
    if (pushBranch !== project.branch) {
      return reply.status(200).send({ message: `Ignored push to branch ${pushBranch} (configured: ${project.branch})` });
    }

    // Ignore deleted branch pushes
    if (payload.deleted) {
      return reply.status(200).send({ message: 'Ignored deleted branch push' });
    }

    const commitSha = payload.after || payload.head_commit?.id || crypto.randomBytes(20).toString('hex');
    const commitMessage = payload.head_commit?.message || `GitHub Webhook push to ${pushBranch}`;

    const deployment = await createDeployment({
      project_id: project.id,
      commit_sha: commitSha,
      commit_message: commitMessage,
      branch: pushBranch,
      trigger: 'WEBHOOK',
    });

    deploymentQueue.enqueue(deployment.id);

    return reply.status(202).send({
      message: 'Webhook received and deployment queued',
      deploymentId: deployment.id,
    });
  });
}
