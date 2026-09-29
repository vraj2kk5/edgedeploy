import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth.js';
import { listAllUsers, findUserById, setUserBlockedStatus } from '../repositories/users.repo.js';

export async function adminUsersRoutes(fastify: FastifyInstance): Promise<void> {
  // Pre-handler hook for admin-only protection
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole('ADMIN'));

  // List all users
  fastify.get('/api/admin/users', async (request, reply) => {
    const users = await listAllUsers();
    return reply.send({ users });
  });

  // Block user
  fastify.patch('/api/admin/users/:id/block', async (request, reply) => {
    const { id } = request.params as { id: string };
    const targetUserId = parseInt(id, 10);

    if (isNaN(targetUserId)) {
      return reply.status(400).send({ error: { code: 400, message: 'Invalid user ID' } });
    }

    if (targetUserId === request.user!.id) {
      return reply.status(400).send({ error: { code: 400, message: 'Admin users cannot block themselves' } });
    }

    const targetUser = await findUserById(targetUserId);
    if (!targetUser) {
      return reply.status(404).send({ error: { code: 404, message: 'User not found' } });
    }

    await setUserBlockedStatus(targetUserId, true);
    return reply.send({ message: `User ${targetUser.email} has been blocked successfully` });
  });

  // Unblock user
  fastify.patch('/api/admin/users/:id/unblock', async (request, reply) => {
    const { id } = request.params as { id: string };
    const targetUserId = parseInt(id, 10);

    if (isNaN(targetUserId)) {
      return reply.status(400).send({ error: { code: 400, message: 'Invalid user ID' } });
    }

    const targetUser = await findUserById(targetUserId);
    if (!targetUser) {
      return reply.status(404).send({ error: { code: 404, message: 'User not found' } });
    }

    await setUserBlockedStatus(targetUserId, false);
    return reply.send({ message: `User ${targetUser.email} has been unblocked successfully` });
  });
}
