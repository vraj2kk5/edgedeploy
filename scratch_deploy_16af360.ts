import mysql from 'mysql2/promise';
import { processDeploymentBuild } from './backend/src/services/build.service.js';

async function run() {
  const db = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'edgedeploy' });
  const [res]: any = await db.query(
    `INSERT INTO deployments (project_id, commit_sha, commit_message, branch, status, \`trigger\`, created_at, started_at)
     VALUES (4, '16af360', 'Auto-detect sample-project static output in build service', 'main', 'BUILDING', 'MANUAL', NOW(), NOW())`
  );
  const deploymentId = res.insertId;
  console.log(`🚀 Created Deployment #${deploymentId} for commit 16af360...`);
  await db.end();

  await processDeploymentBuild(deploymentId);
  console.log(`✅ Deployment #${deploymentId} finished successfully!`);
  process.exit(0);
}

run();
