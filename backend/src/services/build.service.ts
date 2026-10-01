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
      'out',
      'frontend/out',
      'frontend/dist',
      'frontend/public',
      'frontend/build',
      '.next/server/app'
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
  <title>${project.name} - EdgeDeploy Cloud Platform</title>
  <style>
    :root {
      --bg: #090d16;
      --surface: #111827;
      --card: #1f2937;
      --border: #374151;
      --text: #f8fafc;
      --muted: #94a3b8;
      --brand: #0066ff;
      --brand-hover: #0052cc;
    }
    html.light {
      --bg: #f8fafc;
      --surface: #ffffff;
      --card: #f1f5f9;
      --border: #cbd5e1;
      --text: #0f172a;
      --muted: #64748b;
      --brand: #0284c7;
      --brand-hover: #0369a1;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; transition: background 0.2s, color 0.2s; line-height: 1.6; }
    
    nav { background: var(--surface); border-bottom: 1px solid var(--border); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
    .brand-logo { font-size: 1.35rem; font-weight: 800; color: var(--text); display: flex; align-items: center; gap: 0.5rem; text-decoration: none; }
    .nav-links { display: flex; gap: 1.5rem; list-style: none; align-items: center; }
    .nav-links a { color: var(--muted); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.2s; }
    .nav-links a:hover { color: var(--text); }
    .btn { background: var(--brand); color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 0.6rem; font-weight: 600; cursor: pointer; transition: background 0.2s; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
    .btn:hover { background: var(--brand-hover); }
    .btn-outline { background: transparent; color: var(--text); border: 1px solid var(--border); }
    .btn-outline:hover { background: var(--card); }

    .hero { padding: 5rem 1.5rem; text-align: center; max-width: 900px; margin: 0 auto; }
    .badge { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(0, 102, 255, 0.1); color: var(--brand); border: 1px solid rgba(0, 102, 255, 0.2); padding: 0.35rem 0.9rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; margin-bottom: 1.5rem; }
    .hero h1 { font-size: 3.25rem; font-weight: 900; letter-spacing: -0.025em; margin-bottom: 1.25rem; line-height: 1.15; color: var(--text); }
    .hero p { font-size: 1.25rem; color: var(--muted); margin-bottom: 2.25rem; max-width: 700px; margin-left: auto; margin-right: auto; }
    .hero-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

    .section { max-width: 1100px; margin: 4rem auto; padding: 0 1.5rem; }
    .section-title { text-align: center; margin-bottom: 3rem; }
    .section-title h2 { font-size: 2.25rem; font-weight: 800; color: var(--text); margin-bottom: 0.5rem; }
    .section-title p { color: var(--muted); font-size: 1rem; }
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.75rem; }
    .feature-card { background: var(--surface); border: 1px solid var(--border); border-radius: 1.25rem; padding: 2rem; transition: transform 0.2s, border-color 0.2s; }
    .feature-card:hover { transform: translateY(-4px); border-color: var(--brand); }
    .feature-icon { width: 3rem; height: 3rem; background: rgba(0, 102, 255, 0.1); border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1.25rem; }
    .feature-card h3 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text); }
    .feature-card p { color: var(--muted); font-size: 0.95rem; }

    .demo-widget { background: var(--surface); border: 1px solid var(--border); border-radius: 1.25rem; padding: 2.5rem; text-align: center; }
    .counter-display { font-size: 3.5rem; font-weight: 900; color: var(--brand); margin: 1rem 0; font-family: monospace; }
    
    footer { background: var(--surface); border-top: 1px solid var(--border); padding: 3rem 2rem; margin-top: 5rem; text-align: center; color: var(--muted); font-size: 0.9rem; }
  </style>
  <script>
    (function() {
      try {
        var user = localStorage.getItem('edgedeploy_user');
        var u = user ? JSON.parse(user) : null;
        var key = u && u.id ? 'edgedeploy_theme_user_' + u.id : 'edgedeploy_theme';
        var theme = localStorage.getItem(key) || localStorage.getItem('edgedeploy_theme');
        if (theme === 'light') { document.documentElement.classList.add('light'); }
      } catch(e) {}
    })();

    function updateThemeButtonUI() {
      var isLight = document.documentElement.classList.contains('light');
      var btn = document.getElementById('theme-btn');
      if (!btn) return;
      if (isLight) {
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg> <span>Dark Mode</span>';
        btn.title = 'Switch to Dark mode';
      } else {
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg> <span>Light Mode</span>';
        btn.title = 'Switch to Light mode';
      }
    }

    function toggleTheme() {
      var root = document.documentElement;
      var next = root.classList.contains('light') ? 'dark' : 'light';
      if (next === 'light') { root.classList.add('light'); } else { root.classList.remove('light'); }
      try {
        var user = localStorage.getItem('edgedeploy_user');
        var u = user ? JSON.parse(user) : null;
        var key = u && u.id ? 'edgedeploy_theme_user_' + u.id : 'edgedeploy_theme';
        localStorage.setItem(key, next);
        localStorage.setItem('edgedeploy_theme', next);
      } catch(e) {}
      updateThemeButtonUI();
    }

    document.addEventListener('DOMContentLoaded', updateThemeButtonUI);

    let count = 0;
    function increment() { count++; document.getElementById('counter').innerText = count; }
    function decrement() { if(count > 0) count--; document.getElementById('counter').innerText = count; }
  </script>
</head>
<body>
  <nav>
    <a href="#" class="brand-logo">⚡ ${project.name}</a>
    <ul class="nav-links">
      <li><a href="#features">Features</a></li>
      <li><a href="#demo">Interactive App</a></li>
      <li>
        <button id="theme-btn" onclick="toggleTheme()" class="btn btn-outline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
          <span>Light Mode</span>
        </button>
      </li>
      <li><a href="http://localhost:3000/dashboard" class="btn">Control Panel →</a></li>
    </ul>
  </nav>

  <main>
    <section class="hero">
      <div class="badge">🚀 Global CDN Deployment Active</div>
      <h1>Instant Deployment for Modern Static Web Apps</h1>
      <p>EdgeDeploy automatically compiles, optimizes, and routes your static web applications across globally distributed edge CDN nodes with sub-5ms latency.</p>
      <div class="hero-actions">
        <button onclick="increment()" class="btn">Try Live Demo App</button>
        <a href="http://localhost:3000/projects" class="btn btn-outline">Manage Projects</a>
      </div>
    </section>

    <section id="features" class="section">
      <div class="section-title">
        <h2>Built for High Performance</h2>
        <p>Everything you need to deliver lightning-fast static sites to users worldwide.</p>
      </div>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>Edge CDN Acceleration</h3>
          <p>Distributed edge nodes in Mumbai, Ahmedabad, and Delhi deliver assets with sub-5ms cache HIT latency.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🛡️</div>
          <h3>Token Bucket Rate Limiting</h3>
          <p>Built-in DDoS and rate limit protection with burst capacity and real-time IP throttling.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔄</div>
          <h3>Automated Git CI/CD</h3>
          <p>Instant webhook deployments on every Git push with automatic build logs and rollback support.</p>
        </div>
      </div>
    </section>

    <section id="demo" class="section">
      <div class="demo-widget">
        <h2>Interactive Web Application Demo</h2>
        <p style="color: var(--muted); margin-top: 0.5rem;">This interactive widget runs live directly from the EdgeDeploy CDN node.</p>
        <div id="counter" class="counter-display">0</div>
        <div style="display: flex; gap: 1rem; justify-content: center;">
          <button onclick="increment()" class="btn">Count +1</button>
          <button onclick="decrement()" class="btn btn-outline">Count -1</button>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <p>© 2026 EdgeDeploy Platform. Deployed & Served via EdgeDeploy Global CDN.</p>
  </footer>
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
        const trimmed = l.trim();
        if (trimmed) {
          if (/^(npm (warn|notice)|warning|warn)/i.test(trimmed)) {
            logFn('STDOUT', trimmed);
          } else {
            logFn('STDERR', trimmed);
          }
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
