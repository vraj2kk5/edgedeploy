import { processDeploymentBuild } from './backend/src/services/build.service.js';

async function run() {
  console.log('Running processDeploymentBuild for deployment 25...');
  try {
    await processDeploymentBuild(25);
    console.log('✅ Deployment 25 build completed successfully!');
  } catch (err: any) {
    console.error('❌ Deployment 25 build failed:', err.message);
  }
  process.exit(0);
}

run();
