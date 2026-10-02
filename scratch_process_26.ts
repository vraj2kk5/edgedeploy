import { processDeploymentBuild } from './backend/src/services/build.service.js';

async function run() {
  console.log('Running processDeploymentBuild for deployment 26...');
  try {
    await processDeploymentBuild(26);
    console.log('✅ Deployment 26 build completed successfully!');
  } catch (err: any) {
    console.error('❌ Deployment 26 build failed:', err.message);
  }
  process.exit(0);
}

run();
