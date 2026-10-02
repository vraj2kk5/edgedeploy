import { processDeploymentBuild } from './backend/src/services/build.service.js';

async function run() {
  console.log('Running processDeploymentBuild for deployment 24...');
  try {
    await processDeploymentBuild(24);
    console.log('✅ Deployment 24 build completed successfully!');
  } catch (err: any) {
    console.error('❌ Deployment 24 build failed:', err.message);
  }
  process.exit(0);
}

run();
