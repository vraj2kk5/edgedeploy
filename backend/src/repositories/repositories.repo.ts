import { queryOne, execute, Repository } from '@edgedeploy/shared';

export async function findRepositoryByProjectId(projectId: number): Promise<Repository | null> {
  return queryOne<Repository>('SELECT * FROM Repositories WHERE project_id = ?', [projectId]);
}

export async function findRepositoryByOwnerAndName(owner: string, name: string): Promise<Repository | null> {
  return queryOne<Repository>('SELECT * FROM Repositories WHERE owner = ? AND name = ?', [owner, name]);
}

export async function createRepository(data: {
  project_id: number;
  repo_url: string;
  owner: string;
  name: string;
  default_branch: string;
  webhook_id: string | null;
  webhook_secret: string | null;
}): Promise<Repository> {
  await execute(
    `INSERT INTO Repositories (project_id, repo_url, owner, name, default_branch, webhook_id, webhook_secret)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       repo_url = VALUES(repo_url),
       owner = VALUES(owner),
       name = VALUES(name),
       default_branch = VALUES(default_branch),
       webhook_id = VALUES(webhook_id),
       webhook_secret = VALUES(webhook_secret)`,
    [
      data.project_id,
      data.repo_url,
      data.owner,
      data.name,
      data.default_branch,
      data.webhook_id,
      data.webhook_secret,
    ]
  );

  const repo = await findRepositoryByProjectId(data.project_id);
  if (!repo) {
    throw new Error('Failed to create repository record');
  }
  return repo;
}

export async function deleteRepository(projectId: number): Promise<boolean> {
  const result = await execute('DELETE FROM Repositories WHERE project_id = ?', [projectId]);
  return result.affectedRows > 0;
}
