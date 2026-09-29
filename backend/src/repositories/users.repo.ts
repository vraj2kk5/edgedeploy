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
