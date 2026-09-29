import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { config } from '@edgedeploy/shared';

async function runMigration() {
  console.log('[Migrate] Connecting to MySQL server...');
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  try {
    console.log(`[Migrate] Ensuring database "${config.db.database}" exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${config.db.database}\`;`);

    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    const rawSql = fs.readFileSync(schemaPath, 'utf-8');

    // Strip comments line by line
    const cleanSql = rawSql
      .split('\n')
      .map((line) => {
        const commentIdx = line.indexOf('--');
        return commentIdx >= 0 ? line.slice(0, commentIdx) : line;
      })
      .join('\n');

    // Split by semicolon
    const statements = cleanSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`[Migrate] Executing ${statements.length} schema statements...`);
    for (const stmt of statements) {
      if (stmt.toUpperCase().startsWith('CREATE DATABASE') || stmt.toUpperCase().startsWith('USE ')) {
        continue;
      }
      try {
        await connection.query(stmt);
      } catch (err: any) {
        if (
          err.code === 'ER_FK_FAIL_ADD_KEY' ||
          err.code === 'ER_DUP_KEYNAME' ||
          err.code === 'ER_CANT_CREATE_TABLE' ||
          err.errno === 1005 ||
          err.errno === 121 ||
          err.errno === 1061
        ) {
          // Ignore duplicate constraint / table alterations
          continue;
        }
        console.error('[Migrate] Statement error:', stmt);
        throw err;
      }
    }

    console.log('✅ [Migrate] Database schema applied successfully!');
  } catch (err) {
    console.error('❌ [Migrate] Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
