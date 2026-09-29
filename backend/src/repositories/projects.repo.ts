import { query, queryOne, execute, Project, DomainRecord } from '@edgedeploy/shared';

export async function findProjectById(id: number): Promise<Project | null> {
  return queryOne<Project>('SELECT * FROM Projects WHERE id = ?', [id]);
}

export async function findProjectBySlug(slug: string): Promise<Project | null> {
  return queryOne<Project>('SELECT * FROM Projects WHERE slug = ?', [slug]);
}

export async function listProjectsByUser(userId: number): Promise<Project[]> {
  return query<Project>('SELECT * FROM Projects WHERE user_id = ? ORDER BY created_at DESC', [userId]);
}

export async function listAllProjects(): Promise<Project[]> {
  return query<Project>('SELECT * FROM Projects ORDER BY created_at DESC');
}

export async function createProject(data: {
  user_id: number;
  name: string;
  slug: string;
  build_command?: string;
  output_directory?: string;
  install_command?: string;
  branch?: string;
}): Promise<Project> {
  const result = await execute(
    `INSERT INTO Projects (user_id, name, slug, build_command, output_directory, install_command, branch)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.name,
      data.slug,
      data.build_command || 'npm run build',
      data.output_directory || 'dist',
      data.install_command || 'npm install',
      data.branch || 'main',
    ]
  );

  const project = await findProjectById(result.insertId);
  if (!project) {
    throw new Error('Failed to create project');
  }

  // Create Domain mapping
  await execute(
    `INSERT INTO Domains (project_id, hostname, is_primary) VALUES (?, ?, TRUE)`,
    [project.id, `${project.slug}.localhost`]
  );

  return project;
}

export async function updateProject(id: number, data: Partial<Project>): Promise<Project | null> {
  const fields: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    params.push(data.name);
  }
  if (data.build_command !== undefined) {
    fields.push('build_command = ?');
    params.push(data.build_command);
  }
  if (data.output_directory !== undefined) {
    fields.push('output_directory = ?');
    params.push(data.output_directory);
  }
  if (data.install_command !== undefined) {
    fields.push('install_command = ?');
    params.push(data.install_command);
  }
  if (data.branch !== undefined) {
    fields.push('branch = ?');
    params.push(data.branch);
  }
  if (data.active_deployment_id !== undefined) {
    fields.push('active_deployment_id = ?');
    params.push(data.active_deployment_id);
  }

  if (fields.length === 0) {
    return findProjectById(id);
  }

  params.push(id);
  await execute(`UPDATE Projects SET ${fields.join(', ')} WHERE id = ?`, params);
  return findProjectById(id);
}

export async function deleteProject(id: number): Promise<boolean> {
  const result = await execute('DELETE FROM Projects WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

export async function findDomainByHostname(hostname: string): Promise<DomainRecord | null> {
  return queryOne<DomainRecord>('SELECT * FROM Domains WHERE hostname = ?', [hostname]);
}
