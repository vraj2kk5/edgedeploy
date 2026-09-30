import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import fastifyRawBody from 'fastify-raw-body';
import { config, logger } from '@edgedeploy/shared';
import { authRoutes } from './routes/auth.routes.js';
import { adminUsersRoutes } from './routes/admin-users.routes.js';
import { projectsRoutes } from './routes/projects.routes.js';
import { webhookRoutes } from './routes/webhooks.routes.js';
import { adminRoutes } from './routes/admin.routes.js';

export async function buildBackendApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(formbody);

  await app.register(fastifyRawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
    routes: ['/api/webhooks/github'],
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'healthy', service: 'control-plane', timestamp: new Date().toISOString() };
  });

  // Root welcome route
  app.get('/', async () => {
    return {
      service: 'EdgeDeploy Backend Control Plane API',
      status: 'online',
      version: '1.0.0',
      dashboard: 'http://localhost:3000',
      health: 'http://localhost:3001/health',
      docs: 'REST API endpoints available under /api/*'
    };
  });

  // Register domain routes
  await app.register(authRoutes);
  await app.register(adminUsersRoutes);
  await app.register(projectsRoutes);
  await app.register(webhookRoutes);
  await app.register(adminRoutes);

  // Centralized error handler
  app.setErrorHandler((error: any, request, reply) => {
    logger.error(`[API Error] ${error.message || error}`);
    const statusCode = error.statusCode || 500;
    
    let userMessage = error.message || 'Error occurred';
    if (statusCode === 500) {
      userMessage = 'An unexpected internal server error occurred';
    }

    reply.status(statusCode).send({
      error: {
        code: statusCode,
        message: userMessage,
      },
    });
  });

  return app;
}
