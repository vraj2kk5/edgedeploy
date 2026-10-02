import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config, JWTPayload } from '@edgedeploy/shared';
import crypto from 'crypto';
import { createUser, findUserByEmail, setResetToken, findUserByResetToken, updateUserPassword } from '../repositories/users.repo.js';
import { authenticate } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/email.service.js';

const passwordValidation = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const signupSchema = z.object({
  email: z.string().email(),
  password: passwordValidation,
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

  // Forgot Password - Generate reset token
  fastify.post('/api/auth/forgot-password', async (request, reply) => {
    const schema = z.object({ email: z.string().email() });
    const parseResult = schema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: { code: 400, message: 'Invalid email address' } });
    }

    const { email } = parseResult.data;
    const user = await findUserByEmail(email);

    if (!user) {
      return reply.status(404).send({
        error: { code: 404, message: 'No account exists with this email address. Please sign up to continue.' },
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour expiration

    await setResetToken(user.id, resetToken, expiresAt);

    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
    const emailPreviewUrl = await sendPasswordResetEmail({
      toEmail: user.email,
      resetLink,
      resetToken,
    });

    return reply.send({
      message: `Password reset email sent to ${user.email}.`,
      resetToken,
      resetLink,
      emailPreviewUrl,
    });
  });

  // Reset Password - Verify token and update password
  fastify.post('/api/auth/reset-password', async (request, reply) => {
    const schema = z.object({
      token: z.string().min(1, 'Reset token is required'),
      newPassword: passwordValidation,
    });

    const parseResult = schema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 400, message: 'Validation failed', details: parseResult.error.format() },
      });
    }

    const { token, newPassword } = parseResult.data;
    const user = await findUserByResetToken(token);

    if (!user) {
      return reply.status(400).send({
        error: { code: 400, message: 'Invalid or expired password reset token' },
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateUserPassword(user.id, passwordHash);

    return reply.send({
      message: 'Password has been successfully updated. You can now log in.',
    });
  });
}

