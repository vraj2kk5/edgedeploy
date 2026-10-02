import { query, queryOne, execute, User } from '@edgedeploy/shared';

export async function findUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM Users WHERE email = ?', [email]);
}

export async function findUserById(id: number): Promise<User | null> {
  return queryOne<User>('SELECT * FROM Users WHERE id = ?', [id]);
}

export async function createUser(email: string, passwordHash: string, role: 'DEVELOPER' | 'ADMIN' = 'DEVELOPER'): Promise<User> {
  const result = await execute(
    'INSERT INTO Users (email, password_hash, role) VALUES (?, ?, ?)',
    [email, passwordHash, role]
  );
  const user = await findUserById(result.insertId);
  if (!user) {
    throw new Error('Failed to retrieve newly created user');
  }
  return user;
}

export async function listAllUsers(): Promise<Omit<User, 'password_hash'>[]> {
  return query<Omit<User, 'password_hash'>>(
    'SELECT id, email, role, is_blocked, created_at FROM Users ORDER BY id ASC'
  );
}

export async function setUserBlockedStatus(userId: number, isBlocked: boolean): Promise<boolean> {
  const result = await execute(
    'UPDATE Users SET is_blocked = ? WHERE id = ?',
    [isBlocked, userId]
  );
  return result.affectedRows > 0;
}

export async function setResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
  await execute(
    'UPDATE Users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
    [token, expiresAt, userId]
  );
}

export async function findUserByResetToken(token: string): Promise<User | null> {
  return queryOne<User>(
    'SELECT * FROM Users WHERE reset_token = ? AND reset_token_expires > NOW()',
    [token]
  );
}

export async function updateUserPassword(userId: number, passwordHash: string): Promise<void> {
  await execute(
    'UPDATE Users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
    [passwordHash, userId]
  );
}

