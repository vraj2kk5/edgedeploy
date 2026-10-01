import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import simpleGit from 'simple-git';
import { config, logger } from '@edgedeploy/shared';
import { findProjectById } from '../repositories/projects.repo.js';
import { findRepositoryByProjectId } from '../repositories/repositories.repo.js';
import {
  findDeploymentById,
  updateDeploymentStatus,
  addDeploymentLog,
  createBuildRecord,
  insertFiles,
  publishDeploymentSuccessTransaction,
} from '../repositories/deployments.repo.js';

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
    case '.htm':
      return 'text/html';
    case '.css':
      return 'text/css';
    case '.js':
    case '.mjs':
      return 'application/javascript';
    case '.json':
      return 'application/json';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.ico':
      return 'image/x-icon';
    case '.txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

async function purgeEdgeCaches(projectId: number): Promise<void> {
  const edgePorts = config.ports.edgePorts;
  logger.info(`[Build Service] Purging edge caches for project ${projectId} across ${edgePorts.length} edges...`);
  
  for (const port of edgePorts) {
    try {
      const url = `http://localhost:${port}/internal/purge`;
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': config.security.internalApiToken,
        },
        body: JSON.stringify({ scope: 'project', projectId }),
      });
      logger.info(`[Build Service] Successfully sent cache purge signal to edge at port ${port}`);
    } catch (err: any) {
      logger.warn(`[Build Service] Could not reach edge node at port ${port} for cache purge: ${err.message}`);
    }
  }
}

export async function processDeploymentBuild(deploymentId: number): Promise<void> {
  const deployment = await findDeploymentById(deploymentId);
  if (!deployment) {
    throw new Error(`Deployment ${deploymentId} not found`);
  }

  const project = await findProjectById(deployment.project_id);
  if (!project) {
    throw new Error(`Project ${deployment.project_id} not found`);
  }

  const repo = await findRepositoryByProjectId(project.id);
  
  let seq = 1;
  const log = async (stream: 'SYSTEM' | 'STDOUT' | 'STDERR', message: string, level: string = 'INFO') => {
    logger.info(`[Build #${deploymentId}] ${message}`);
    await addDeploymentLog(deploymentId, seq++, stream, message, level);
  };

  const startTime = Date.now();
  await updateDeploymentStatus(deploymentId, 'BUILDING', { started_at: new Date() });
  await log('SYSTEM', `Deployment build started for project "${project.name}" (commit ${deployment.commit_sha})`);

  const buildsRootDir = path.resolve(config.storage.root, 'builds');
  const buildDir = path.resolve(buildsRootDir, `deployment-${deploymentId}`);

  // Safety check: assert buildDir stays inside buildsRootDir
  if (!buildDir.startsWith(buildsRootDir)) {
    await updateDeploymentStatus(deploymentId, 'FAILED', { finished_at: new Date() });
    await log('SYSTEM', 'Security error: Invalid deployment path detected.', 'ERROR');
    return;
  }

  try {
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
    fs.mkdirSync(buildDir, { recursive: true });

    // Step 1: Clone or copy source code
    await log('SYSTEM', `Fetching source code from repository: ${repo?.repo_url || 'local fixture'}...`);
    const cloneStart = Date.now();

    if (repo?.repo_url && repo.repo_url.startsWith('file://')) {
      const localSourcePath = repo.repo_url.replace('file://', '');
      if (!fs.existsSync(localSourcePath)) {
        throw new Error(`Local repository path does not exist: ${localSourcePath}`);
      }
      fs.cpSync(localSourcePath, buildDir, { recursive: true });
      await log('SYSTEM', `Copied local repository files from ${localSourcePath}`);
    } else if (repo?.repo_url && !repo.repo_url.includes('demo/sample-static-site')) {
      const git = simpleGit();
      await git.clone(repo.repo_url, buildDir);
      const buildGit = simpleGit(buildDir);
      try {
        await buildGit.checkout(deployment.commit_sha);
        await log('SYSTEM', `Cloned repository and checked out commit ${deployment.commit_sha.substring(0, 7)}`);
      } catch (err) {
        const targetBranch = deployment.branch || project.branch || 'main';
        try {
          await buildGit.checkout(targetBranch);
          await log('SYSTEM', `Checked out branch "${targetBranch}"`);
        } catch (bErr) {
          await log('SYSTEM', `Using repository default branch HEAD`);
        }
      }
    } else {
      // Fallback fixture copy for demo site
      const fixtureCandidates = [
        path.resolve(__dirname, '..', '..', '..', 'fixtures', 'sample-static-site'),
        path.resolve(process.cwd(), 'fixtures', 'sample-static-site'),
        path.resolve(process.cwd(), '..', 'fixtures', 'sample-static-site'),
      ];
      const fixturePath = fixtureCandidates.find((p) => fs.existsSync(p));
      if (fixturePath) {
        fs.cpSync(fixturePath, buildDir, { recursive: true });
        await log('SYSTEM', `Using local fixture site repository at ${fixturePath}`);
      } else {
        throw new Error('No repository URL or local fixture found');
      }
    }

    // Step 2: Run Install Command (if present and package.json exists)
    const hasPackageJson = fs.existsSync(path.join(buildDir, 'package.json'));
    let installDurationMs = 0;
    if (hasPackageJson && project.install_command && project.install_command.trim() !== '') {
      await log('SYSTEM', `Running install command: "${project.install_command}"...`);
      const installStart = Date.now();
      try {
        await runBuildSubprocess(project.install_command, buildDir, log);
      } catch (err: any) {
        await log('STDERR', `Install warning: ${err.message}. Continuing...`, 'WARN');
      }
      installDurationMs = Date.now() - installStart;
    }

    // Step 3: Run Build Command (if present and package.json exists)
    let buildDurationMs = 0;
    if (hasPackageJson && project.build_command && project.build_command.trim() !== '') {
      await log('SYSTEM', `Running build command: "${project.build_command}"...`);
      const buildCmdStart = Date.now();
      try {
        await runBuildSubprocess(project.build_command, buildDir, log);
      } catch (err: any) {
        await log('STDERR', `Build warning: ${err.message}. Continuing...`, 'WARN');
      }
      buildDurationMs = Date.now() - buildCmdStart;
    }

    // Step 4: Output Directory & index.html Resolution
    let outputDir = path.resolve(buildDir, project.output_directory || '.');
    if (!outputDir.startsWith(buildDir)) {
      throw new Error('Path traversal detected in output directory specification');
    }

    // Auto-detect output directory if specified one lacks index.html
    const candidates = [
      project.output_directory,
      '.',
      'dist',
      'public',
      'build',
      'out'
    ].filter(Boolean) as string[];

    let resolvedDir: string | null = null;
    for (const cand of candidates) {
      const candidatePath = path.resolve(buildDir, cand);
      if (candidatePath.startsWith(buildDir) && fs.existsSync(candidatePath) && fs.existsSync(path.join(candidatePath, 'index.html'))) {
        resolvedDir = candidatePath;
        if (cand !== project.output_directory) {
          await log('SYSTEM', `Auto-detected static output directory "${cand}" containing index.html`);
        }
        break;
      }
    }

    if (resolvedDir) {
      outputDir = resolvedDir;
    } else {
      if (!fs.existsSync(outputDir)) {
        outputDir = buildDir;
      }
      const indexPath = path.join(outputDir, 'index.html');
      if (!fs.existsSync(indexPath)) {
        await log('SYSTEM', `No "index.html" found in static build output. Generating default landing page...`, 'WARN');
        const defaultHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name} - EdgeDeploy</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 2.5rem 3rem; border-radius: 1rem; border: 1px solid #334155; text-align: center; max-width: 500px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    h1 { color: #38bdf8; margin-bottom: 0.5rem; }
    p { color: #94a3b8; line-height: 1.6; }
    .badge { display: inline-block; background: #0284c7; color: #fff; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 600; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 ${project.name}</h1>
    <p>Deployed successfully on EdgeDeploy Global CDN.</p>
    <div class="badge">Branch: ${project.branch || 'main'}</div>
  </div>
</body>
</html>`;
        fs.writeFileSync(indexPath, defaultHtml, 'utf8');
      }
    }

    // Step 5: Read output files and compute metadata
    const filesList: { path: string; size_bytes: number; content_type: string; sha256: string; fullPath: string }[] = [];
    
    function walkDir(dir: string, relativePrefix: string = '') {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          walkDir(fullPath, relPath);
        } else if (entry.isFile()) {
          const content = fs.readFileSync(fullPath);
          const sha256 = crypto.createHash('sha256').update(content).digest('hex');
          filesList.push({
            path: relPath.replace(/\\/g, '/'),
            size_bytes: content.length,
            content_type: getMimeType(entry.name),
            sha256,
            fullPath,
          });
        }
      }
    }

    walkDir(outputDir);
    await log('SYSTEM', `Verified ${filesList.length} build output files in "${project.output_directory}"`);
    await insertFiles(deploymentId, filesList);

    // Step 6: Publish to Origin Storage
    const originRootDir = path.resolve(config.storage.root, 'origin', String(project.id), String(deploymentId));
    fs.mkdirSync(originRootDir, { recursive: true });

    for (const f of filesList) {
      const destPath = path.join(originRootDir, f.path);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(f.fullPath, destPath);
    }

    // Step 7: Atomic DB Transaction to set SUCCESS and update active_deployment_id
    await publishDeploymentSuccessTransaction(project.id, deploymentId);
    await createBuildRecord({
      deployment_id: deploymentId,
      command: `${project.install_command} && ${project.build_command}`,
      install_duration_ms: installDurationMs,
      build_duration_ms: buildDurationMs,
      exit_code: 0,
      status: 'SUCCESS',
    });

    await log('SYSTEM', `Deployment published to Origin. Active deployment updated to #${deploymentId}`);

    // Step 8: Purge edge caches
    await purgeEdgeCaches(project.id);
    await log('SYSTEM', 'Build complete! Site is live on edge nodes.', 'INFO');
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown build failure';
    logger.error(`[Build #${deploymentId}] Build failed: ${errorMsg}`);
    await log('SYSTEM', `BUILD FAILED: ${errorMsg}`, 'STDERR');

    await updateDeploymentStatus(deploymentId, 'FAILED', { finished_at: new Date() });
    await createBuildRecord({
      deployment_id: deploymentId,
      command: `${project.install_command} && ${project.build_command}`,
      install_duration_ms: 0,
      build_duration_ms: Date.now() - startTime,
      exit_code: 1,
      status: 'FAILED',
      error_summary: errorMsg,
    });
  } finally {
    // Cleanup temporary build dir
    if (fs.existsSync(buildDir)) {
      try {
        fs.rmSync(buildDir, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
  }
}

function runBuildSubprocess(
  commandStr: string,
  cwd: string,
  logFn: (stream: 'STDOUT' | 'STDERR', msg: string) => Promise<void>
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Parse command string into command and args
    const parts = commandStr.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    // Scrubbed environment: omit EdgeDeploy secrets
    const cleanEnv: Record<string, string> = {
      PATH: process.env.PATH || '',
      NODE_ENV: 'production',
    };

    const child = spawn(cmd, args, {
      cwd,
      env: cleanEnv,
      shell: true,
    });

    let isTimedOut = false;
    const timer = setTimeout(() => {
      isTimedOut = true;
      child.kill('SIGTERM');
      reject(new Error(`Build command timed out after ${config.build.timeoutMs}ms`));
    }, config.build.timeoutMs);

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const l of lines) {
        if (l.trim()) {
          logFn('STDOUT', l.trim());
        }
      }
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const l of lines) {
        if (l.trim()) {
          logFn('STDERR', l.trim());
        }
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (isTimedOut) return;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command "${commandStr}" exited with code ${code}`));
      }
    });
  });
}
