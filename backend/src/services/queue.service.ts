import { logger } from '@edgedeploy/shared';
import { execute } from '@edgedeploy/shared';
import { processDeploymentBuild } from './build.service.js';
import { config } from '@edgedeploy/shared';

class DeploymentQueue {
  private queue: number[] = [];
  private activeCount: number = 0;
  private maxConcurrency: number = config.build.concurrency;

  public async initialize(): Promise<void> {
    // Mark stale BUILDING deployments as FAILED on restart
    logger.info('[Build Queue] Cleaning up stale BUILDING deployments...');
    await execute(
      `UPDATE Deployments 
       SET status = 'FAILED', finished_at = NOW() 
       WHERE status = 'BUILDING'`
    );
  }

  public enqueue(deploymentId: number): void {
    logger.info(`[Build Queue] Enqueuing deployment #${deploymentId}`);
    this.queue.push(deploymentId);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const deploymentId = this.queue.shift()!;
    this.activeCount++;

    logger.info(`[Build Queue] Picked up deployment #${deploymentId} (Active builds: ${this.activeCount})`);
    
    try {
      await processDeploymentBuild(deploymentId);
    } catch (err: any) {
      logger.error(`[Build Queue] Error processing deployment #${deploymentId}: ${err.message}`);
    } finally {
      this.activeCount--;
      this.processNext();
    }
  }
}

export const deploymentQueue = new DeploymentQueue();
