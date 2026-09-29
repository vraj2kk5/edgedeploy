import { buildBackendApp } from './app.js';
import { config, logger } from '@edgedeploy/shared';
import { deploymentQueue } from './services/queue.service.js';

async function start() {
  await deploymentQueue.initialize();
  const app = await buildBackendApp();
  const port = config.ports.backend;

  try {
    await app.listen({ port, host: '0.0.0.0' });
    logger.info(`🚀 [Backend Control Plane] Running on http://localhost:${port}`);
  } catch (err: any) {
    logger.error(`Failed to start Backend server: ${err.message || err}`);
    process.exit(1);
  }
}

start();
