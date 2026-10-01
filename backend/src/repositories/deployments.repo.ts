import { query, queryOne, execute, Deployment, DeploymentLog, Build, FileRecord, getPool } from '@edgedeploy/shared';

export async function findDeploymentById(id: number): Promise<Deployment | null> {
  return queryOne<Deployment>('SELECT * FROM Deployments WHERE id = ?', [id]);
}

export async function listDeploymentsByProject(projectId: number): Promise<Deployment[]> {
  return query<Deployment>(
    'SELECT * FROM Deployments WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  );
}

export async function findLatestDeploymentByPr(projectId: number, prNumber: number): Promise<Deployment | null> {
  return queryOne<Deployment>(
    'SELECT * FROM Deployments WHERE project_id = ? AND pr_number = ? AND status = "SUCCESS" ORDER BY created_at DESC LIMIT 1',
    [projectId, prNumber]
  );
}

export async function findLatestDeploymentByBranch(projectId: number, branch: string): Promise<Deployment | null> {
  return queryOne<Deployment>(
    'SELECT * FROM Deployments WHERE project_id = ? AND branch = ? AND status = "SUCCESS" ORDER BY created_at DESC LIMIT 1',
    [projectId, branch]
  );
}

export async function createDeployment(data: {
  project_id: number;
  commit_sha: string;
  commit_message: string;
  branch: string;
  pr_number?: number | null;
  trigger: 'WEBHOOK' | 'MANUAL' | 'REDEPLOY' | 'PULL_REQUEST';
}): Promise<Deployment> {
  const result = await execute(
    `INSERT INTO Deployments (project_id, commit_sha, commit_message, branch, pr_number, status, \`trigger\`)
     VALUES (?, ?, ?, ?, ?, 'QUEUED', ?)`,
    [data.project_id, data.commit_sha, data.commit_message, data.branch, data.pr_number || null, data.trigger]
  );

  const deployment = await findDeploymentById(result.insertId);
  if (!deployment) {
    throw new Error('Failed to create deployment');
  }
  return deployment;
}

export async function updateDeploymentStatus(
  id: number,
  status: 'QUEUED' | 'BUILDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED',
  dates?: { started_at?: Date; finished_at?: Date }
): Promise<void> {
  const fields = ['status = ?'];
  const params: any[] = [status];

  if (dates?.started_at) {
    fields.push('started_at = ?');
    params.push(dates.started_at);
  }
  if (dates?.finished_at) {
    fields.push('finished_at = ?');
    params.push(dates.finished_at);
  }

  params.push(id);
  await execute(`UPDATE Deployments SET ${fields.join(', ')} WHERE id = ?`, params);
}

export async function addDeploymentLog(
  deploymentId: number,
  seq: number,
  stream: 'SYSTEM' | 'STDOUT' | 'STDERR',
  message: string,
  level: string = 'INFO'
): Promise<void> {
  await execute(
    `INSERT INTO DeploymentLogs (deployment_id, seq, level, stream, message) VALUES (?, ?, ?, ?, ?)`,
    [deploymentId, seq, level, stream, message]
  );
}

export async function getDeploymentLogs(deploymentId: number, afterSeq: number = 0): Promise<DeploymentLog[]> {
  return query<DeploymentLog>(
    'SELECT * FROM DeploymentLogs WHERE deployment_id = ? AND seq > ? ORDER BY seq ASC',
    [deploymentId, afterSeq]
  );
}

export async function createBuildRecord(data: {
  deployment_id: number;
  command: string;
  install_duration_ms: number;
  build_duration_ms: number;
  exit_code: number;
  status: string;
  error_summary?: string;
}): Promise<Build> {
  await execute(
    `INSERT INTO Builds (deployment_id, command, install_duration_ms, build_duration_ms, exit_code, status, error_summary)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       install_duration_ms = VALUES(install_duration_ms),
       build_duration_ms = VALUES(build_duration_ms),
       exit_code = VALUES(exit_code),
       status = VALUES(status),
       error_summary = VALUES(error_summary)`,
    [
      data.deployment_id,
      data.command,
      data.install_duration_ms,
      data.build_duration_ms,
      data.exit_code,
      data.status,
      data.error_summary || null,
    ]
  );
  const row = await queryOne<Build>('SELECT * FROM Builds WHERE deployment_id = ?', [data.deployment_id]);
  return row!;
}

export async function insertFiles(deploymentId: number, files: Omit<FileRecord, 'id' | 'deployment_id'>[]): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const file of files) {
      await conn.execute(
        `INSERT INTO Files (deployment_id, path, size_bytes, content_type, sha256)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE size_bytes = VALUES(size_bytes), content_type = VALUES(content_type), sha256 = VALUES(sha256)`,
        [deploymentId, file.path, file.size_bytes, file.content_type, file.sha256]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function publishDeploymentSuccessTransaction(projectId: number, deploymentId: number): Promise<void> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE Deployments SET status = "SUCCESS", finished_at = NOW() WHERE id = ?', [deploymentId]);
    await conn.execute('UPDATE Projects SET active_deployment_id = ?, updated_at = NOW() WHERE id = ?', [
      deploymentId,
      projectId,
    ]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function findFilesByDeploymentId(deploymentId: number): Promise<FileRecord[]> {
  return query<FileRecord>('SELECT * FROM Files WHERE deployment_id = ?', [deploymentId]);
}
