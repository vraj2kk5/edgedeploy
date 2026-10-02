import { execute, queryOne } from './shared/src/db.js';

async function triggerProject4() {
  const proj: any = await queryOne('SELECT * FROM projects WHERE id = 4');
  if (!proj) return;

  const res = await execute(
    'INSERT INTO deployments (project_id, commit_sha, commit_message, branch, `trigger`, status) VALUES (?, ?, ?, ?, ?, ?)',
    [proj.id, '5771293000000000000000000000000000000000', 'Deployment build with fixed database/package.json', 'main', 'MANUAL', 'QUEUED']
  );

  console.log('Queued new deployment for project 4 with ID:', res.insertId);
  process.exit(0);
}

triggerProject4();
