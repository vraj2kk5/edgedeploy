import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config, JWTPayload } from '@edgedeploy/shared';
import { createUser, findUserByEmail } from '../repositories/users.repo.js';
import { authenticate } from '../middleware/auth.js';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Signup
  fastify.post('/api/auth/signup', async (request, reply) => {
    const parseResult = signupSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 400, message: 'Validation failed', details: parseResult.error.format() },
      });
    }

    const { email, password } = parseResult.data;
    const existing = await findUserByEmail(email);
    if (existing) {
      return reply.status(409).send({
        error: { code: 409, message: 'An account with this email address already exists' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser(email, passwordHash, 'DEVELOPER');

    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as any });

    return reply.status(201).send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        is_blocked: user.is_blocked,
        created_at: user.created_at,
      },
      token,
    });
  });

  // Login
  fastify.post('/api/auth/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 400, message: 'Validation failed', details: parseResult.error.format() },
      });
    }

    const { email, password } = parseResult.data;
    const user = await findUserByEmail(email);
    if (!user) {
      return reply.status(401).send({
        error: { code: 401, message: 'Invalid email or password' },
      });
    }

    if (user.is_blocked) {
      return reply.status(403).send({
        error: { code: 403, message: 'Account is blocked. Please contact support.' },
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return reply.status(401).send({
        error: { code: 401, message: 'Invalid email or password' },
      });
    }

    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as any });

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        is_blocked: user.is_blocked,
        created_at: user.created_at,
      },
      token,
    });
  });

  // Get current user profile
  fastify.get('/api/auth/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user!;
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        is_blocked: user.is_blocked,
        created_at: user.created_at,
      },
    });
  });
}
