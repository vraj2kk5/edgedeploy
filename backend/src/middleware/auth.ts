import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config, JWTPayload, User } from '@edgedeploy/shared';
import { findUserById } from '../repositories/users.repo.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({ error: { code: 401, message: 'Missing or invalid Authorization header' } });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    const user = await findUserById(decoded.userId);

    if (!user) {
      reply.status(401).send({ error: { code: 401, message: 'User specified in token no longer exists' } });
      return;
    }

    if (user.is_blocked) {
      reply.status(403).send({ error: { code: 403, message: 'Account is blocked. Contact support.' } });
      return;
    }

    request.user = user;
  } catch (err) {
    reply.status(401).send({ error: { code: 401, message: 'Invalid or expired access token' } });
  }
}

export function requireRole(role: 'ADMIN' | 'DEVELOPER') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.status(401).send({ error: { code: 401, message: 'Authentication required' } });
      return;
    }
    if (request.user.role !== role) {
      reply.status(403).send({ error: { code: 403, message: `Access denied. Requires ${role} role.` } });
      return;
    }
  };
}
