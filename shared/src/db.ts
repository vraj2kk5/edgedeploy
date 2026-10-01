import mysql from 'mysql2/promise';
import { config } from './config.js';
import { logger } from './logger.js';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: config.db.connectionLimit,
      queueLimit: 0,
      multipleStatements: true,
      timezone: 'local',
      connectTimeout: 15000,
    });
    logger.info(`[DB Pool] Initialized MySQL pool for ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`);
  }
  return pool;
}

export async function query<T = any>(sql: string, params: any[] = [], retries: number = 6): Promise<T[]> {
  const p = getPool();
  for (let i = 0; i < retries; i++) {
    try {
      const [rows] = await p.execute(sql, params);
      return rows as T[];
    } catch (err: any) {
      if ((err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') && i < retries - 1) {
        logger.warn(`[DB Pool] Query attempt ${i + 1} failed (${err.code}). Retrying in 2s...`);
        await new Promise((res) => setTimeout(res, 2000));
        continue;
      }
      throw err;
    }
  }
  return [];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(sql: string, params: any[] = [], retries: number = 6): Promise<mysql.ResultSetHeader> {
  const p = getPool();
  for (let i = 0; i < retries; i++) {
    try {
      const [result] = await p.execute(sql, params);
      return result as mysql.ResultSetHeader;
    } catch (err: any) {
      if ((err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST') && i < retries - 1) {
        logger.warn(`[DB Pool] Execute attempt ${i + 1} failed (${err.code}). Retrying in 2s...`);
        await new Promise((res) => setTimeout(res, 2000));
        continue;
      }
      throw err;
    }
  }
  return { affectedRows: 0, insertId: 0 } as any;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('[DB Pool] Connection pool closed.');
  }
}
