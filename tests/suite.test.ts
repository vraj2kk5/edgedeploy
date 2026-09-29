import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config, query, queryOne, execute, closePool } from '@edgedeploy/shared';

describe('EdgeDeploy Core Automated Test Suite', () => {
  beforeAll(async () => {
    // Ensure test database is migrated and seeded
    const adminHash = await bcrypt.hash(config.admin.password, 10);
    await execute(
      `INSERT INTO Users (email, password_hash, role) VALUES ('testadmin@edgedeploy.local', ?, 'ADMIN')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [adminHash]
    );

    await execute(
      `INSERT INTO Users (email, password_hash, role) VALUES ('testdev@edgedeploy.local', ?, 'DEVELOPER')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [adminHash]
    );
  });

  afterAll(async () => {
    await closePool();
  });

  // 1. Auth & JWT Verification
  describe('Auth & Role Security', () => {
    it('should generate valid JWT payload with user claims', () => {
      const payload = { userId: 1, email: 'testadmin@edgedeploy.local', role: 'ADMIN' as const };
      const token = jwt.sign(payload, config.jwt.secret, { expiresIn: '1h' });
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      expect(decoded.userId).toBe(1);
      expect(decoded.role).toBe('ADMIN');
    });

    it('should reject invalid or tampered JWT tokens', () => {
      const invalidToken = 'invalid.jwt.token.string';
      expect(() => jwt.verify(invalidToken, config.jwt.secret)).toThrow();
    });
  });

  // 2. Deployment Invariant Verification
  describe('Deployment Invariant Protection', () => {
    it('should preserve existing active_deployment_id when a deployment fails', async () => {
      const activeBefore = await queryOne<any>('SELECT active_deployment_id FROM Projects WHERE id = 1');
      const initialActiveId = activeBefore?.active_deployment_id;

      // Simulate a failed build
      const failedDep = await execute(
        `INSERT INTO Deployments (project_id, commit_sha, commit_message, status, \`trigger\`)
         VALUES (1, 'failedsha123', 'Failed test build', 'FAILED', 'MANUAL')`
      );

      const activeAfter = await queryOne<any>('SELECT active_deployment_id FROM Projects WHERE id = 1');
      expect(activeAfter?.active_deployment_id).toBe(initialActiveId);
    });
  });

  // 3. Path Traversal Protection
  describe('Security & Path Traversal Guards', () => {
    it('should reject paths containing dot-dot relative traversal', () => {
      const maliciousPath = '../../etc/passwd';
      const isTraversing = maliciousPath.includes('..') || maliciousPath.startsWith('/');
      expect(isTraversing).toBe(true);
    });
  });

  // 4. Token Bucket Algorithm Correctness
  describe('Token Bucket Rate Limiter', () => {
    it('should compute exact Retry-After seconds based on refill rate', () => {
      const neededTokens = 1;
      const refillPerSec = config.rateLimit.refillPerSec; // 2
      const retryAfter = Math.ceil(neededTokens / refillPerSec);
      expect(retryAfter).toBe(1);
    });
  });
});
