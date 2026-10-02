import { query } from './shared/src/db.js';

async function check() {
  const deps: any = await query('SELECT id, project_id, status, commit_sha, created_at FROM deployments WHERE project_id = 4 ORDER BY id DESC LIMIT 5');
  console.log('=== LATEST DEPLOYMENTS FOR PROJECT 4 ===');
  console.table(deps);
  process.exit(0);
}

check();
