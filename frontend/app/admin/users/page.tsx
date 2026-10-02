'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, ShieldAlert, Lock, Unlock } from 'lucide-react';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = sessionStorage.getItem('edgedeploy_user') || localStorage.getItem('edgedeploy_user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {}
    }
  }, []);

  const handleUnauthorized = () => {
    localStorage.removeItem('edgedeploy_token');
    localStorage.removeItem('edgedeploy_user');
    router.push('/login');
  };

  const fetchUsers = async () => {
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleBlock = async (userId: number, currentBlocked: boolean) => {
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const endpoint = `/api/admin/users/${userId}/${currentBlocked ? 'unblock' : 'block'}`;
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Operation failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-amber-400" /> User Management & RBAC
        </h1>
        <p className="text-sm text-gray-400 mt-1">Review user roles and toggle account block status</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-card border-b border-border text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Created At</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-card/50 transition">
                  <td className="p-4 font-mono text-gray-400">{u.id}</td>
                  <td className="p-4 font-semibold text-white">{u.email}</td>
                  <td className="p-4 font-mono text-xs">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    {u.is_blocked ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        BLOCKED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                        ACTIVE
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-gray-400">{new Date(u.created_at).toLocaleString()}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleToggleBlock(u.id, u.is_blocked)}
                      disabled={Boolean(currentUser && (currentUser.id === u.id || currentUser.email === u.email))}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto transition ${
                        currentUser && (currentUser.id === u.id || currentUser.email === u.email)
                          ? 'opacity-40 cursor-not-allowed bg-gray-600/20 text-gray-400 border border-gray-500/30'
                          : u.is_blocked
                          ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30'
                          : 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30'
                      }`}
                    >
                      {u.is_blocked ? (
                        <>
                          <Unlock className="w-3 h-3" /> Unblock
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" /> Block User
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
