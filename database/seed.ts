import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { config } from '@edgedeploy/shared';

async function seed() {
  console.log('[Seed] Connecting to MySQL database...');
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  try {
    console.log('[Seed] Seeding default Admin and Developer users...');
    const adminPasswordHash = await bcrypt.hash(config.admin.password, 10);
    const devPasswordHash = await bcrypt.hash('DevPassword123!', 10);

    // Upsert Admin
    await connection.execute(
      `INSERT INTO Users (email, password_hash, role) 
       VALUES (?, ?, 'ADMIN') 
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [config.admin.email, adminPasswordHash]
    );

    // Upsert Developer
    await connection.execute(
      `INSERT INTO Users (email, password_hash, role) 
       VALUES ('dev@edgedeploy.local', ?, 'DEVELOPER') 
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [devPasswordHash]
    );

    const [adminRows]: any = await connection.execute('SELECT id FROM Users WHERE email = ?', [config.admin.email]);
    const [devRows]: any = await connection.execute('SELECT id FROM Users WHERE email = ?', ['dev@edgedeploy.local']);
    const devUserId = devRows[0].id;

    console.log('[Seed] Seeding EdgeNodes...');
    for (let i = 0; i < config.ports.edgePorts.length; i++) {
      const port = config.ports.edgePorts[i];
      const region = config.ports.edgeRegions[i] || 'Global';
      const name = `edge-${i + 1}`;
      await connection.execute(
        `INSERT INTO EdgeNodes (name, port, region, status, cache_capacity, last_heartbeat)
         VALUES (?, ?, ?, 'HEALTHY', 100, NOW())
         ON DUPLICATE KEY UPDATE status = 'HEALTHY', region = VALUES(region), last_heartbeat = NOW()`,
        [name, port, region]
      );
    }

    console.log('[Seed] Seeding sample project and repository...');
    await connection.execute(
      `INSERT INTO Projects (id, user_id, name, slug, build_command, output_directory, install_command, branch)
       VALUES (1, ?, 'Demo Static Site', 'demo-site', 'npm run build', 'dist', 'npm install', 'main')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [devUserId]
    );

    await connection.execute(
      `INSERT INTO Repositories (project_id, repo_url, owner, name, default_branch, webhook_id, webhook_secret)
       VALUES (1, 'https://github.com/demo/sample-static-site', 'demo', 'sample-static-site', 'main', 'wh_seed_123', 'secret_seed_456')
       ON DUPLICATE KEY UPDATE repo_url = VALUES(repo_url)`,
    );

    await connection.execute(
      `INSERT INTO Domains (project_id, hostname, is_primary)
       VALUES (1, 'demo-site.localhost', TRUE)
       ON DUPLICATE KEY UPDATE hostname = VALUES(hostname)`
    );

    console.log('[Seed] Seeding sample successful deployment...');
    await connection.execute(
      `INSERT INTO Deployments (id, project_id, commit_sha, commit_message, branch, status, \`trigger\`, started_at, finished_at)
       VALUES (1, 1, 'a1b2c3d4e5f6789012345678901234567890a1b2', 'Initial demo site release', 'main', 'SUCCESS', 'MANUAL', NOW(), NOW())
       ON DUPLICATE KEY UPDATE status = 'SUCCESS'`
    );

    await connection.execute(
      `UPDATE Projects SET active_deployment_id = 1 WHERE id = 1`
    );

    await connection.execute(
      `INSERT INTO Builds (deployment_id, command, install_duration_ms, build_duration_ms, exit_code, status, error_summary)
       VALUES (1, 'npm run build', 1200, 2400, 0, 'SUCCESS', NULL)
       ON DUPLICATE KEY UPDATE status = 'SUCCESS'`
    );

    await connection.execute(
      `INSERT INTO DeploymentLogs (deployment_id, seq, level, stream, message) VALUES
       (1, 1, 'INFO', 'SYSTEM', 'Cloning repository https://github.com/demo/sample-static-site...'),
       (1, 2, 'INFO', 'STDOUT', 'Installing dependencies: npm install...'),
       (1, 3, 'INFO', 'STDOUT', 'Running build command: npm run build...'),
       (1, 4, 'INFO', 'SYSTEM', 'Build output verified: dist/index.html found.'),
       (1, 5, 'INFO', 'SYSTEM', 'Deployment published to Origin. Edge caches purged.')
       ON DUPLICATE KEY UPDATE message = VALUES(message)`
    );

    await connection.execute(
      `INSERT INTO Files (deployment_id, path, size_bytes, content_type, sha256) VALUES
       (1, 'index.html', 450, 'text/html', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
       (1, 'style.css', 220, 'text/css', 'c27b0b6c6fa6443c7b2b005175cf14e7a8fb735f4700d7fb409511739c9ffb16')
       ON DUPLICATE KEY UPDATE sha256 = VALUES(sha256)`
    );

    console.log('[Seed] Seeding sample request logs...');
    for (let i = 0; i < 15; i++) {
      const isHit = i % 2 === 0;
      const latency = isHit ? Math.floor(Math.random() * 10) + 2 : Math.floor(Math.random() * 50) + 30;
      await connection.execute(
        `INSERT INTO RequestLogs (client_ip, project_id, domain, path, method, status_code, latency_ms, edge_node_id, cache_result, bytes)
         VALUES ('127.0.0.1', 1, 'demo-site.localhost', '/index.html', 'GET', 200, ?, 1, ?, 450)`,
        [latency, isHit ? 'HIT' : 'MISS']
      );
    }

    console.log('✅ [Seed] Database seeded successfully!');
    console.log('----------------------------------------------------');
    console.log(`Admin User:      ${config.admin.email} / ${config.admin.password}`);
    console.log(`Demo Developer:  dev@edgedeploy.local / DevPassword123!`);
    console.log('----------------------------------------------------');
  } catch (err) {
    console.error('❌ [Seed] Seeding failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seed();
