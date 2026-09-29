'use client';

import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, Lock, Unlock, Plus } from 'lucide-react';

export default function AdminRateLimitsPage() {
  const [rateLimits, setRateLimits] = useState<any[]>([]);
  const [ipToBlock, setIpToBlock] = useState('');
  const [reason, setReason] = useState('Abuse / Excess requests');
  const [loading, setLoading] = useState(true);

  const fetchRateLimits = async () => {
    const token = localStorage.getItem('edgedeploy_token');
    if (!token) return;

    try {
      const res = await fetch('/api/admin/rate-limits', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRateLimits(data.rateLimits || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRateLimits();
  }, []);

  const handleBlockIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipToBlock) return;
    const token = localStorage.getItem('edgedeploy_token');
    try {
      const res = await fetch('/api/admin/rate-limits/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ip: ipToBlock, reason }),
      });
      if (res.ok) {
        setIpToBlock('');
        fetchRateLimits();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnblockIp = async (ip: string) => {
    const token = localStorage.getItem('edgedeploy_token');
    try {
      const res = await fetch('/api/admin/rate-limits/unblock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ip }),
      });
      if (res.ok) {
        fetchRateLimits();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-red-400" /> Gateway Rate Limiter Audit & Firewall
        </h1>
        <p className="text-sm text-gray-400 mt-1">Audit Token Bucket counters and manage client IP blocklist</p>
      </div>

      {/* Manual IP Block Form */}
      <form onSubmit={handleBlockIp} className="bg-surface border border-border p-6 rounded-2xl flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-300 mb-1">Target Client IP</label>
          <input
            type="text"
            required
            value={ipToBlock}
            onChange={(e) => setIpToBlock(e.target.value)}
            placeholder="e.g. 192.168.1.100"
            className="w-full px-4 py-2 bg-card border border-border rounded-xl text-white text-sm font-mono"
          />
        </div>

        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-300 mb-1">Block Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-4 py-2 bg-card border border-border rounded-xl text-white text-sm"
          />
        </div>

        <button
          type="submit"
          className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition flex items-center gap-1.5"
        >
          <Lock className="w-4 h-4" /> Block IP
        </button>
      </form>

      {/* Rate Limits Audit Table */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-card border-b border-border text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="p-4">Client IP</th>
                <th className="p-4">Tokens State</th>
                <th className="p-4">Requests Count</th>
                <th className="p-4">Status</th>
                <th className="p-4">Reason</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rateLimits.map((rl) => (
                <tr key={rl.id} className="hover:bg-card/50 transition">
                  <td className="p-4 font-mono font-bold text-white">{rl.client_ip}</td>
                  <td className="p-4 font-mono text-cyan-400">{Number(rl.tokens).toFixed(1)} / 10.0</td>
                  <td className="p-4 font-mono text-gray-300">{rl.request_count}</td>
                  <td className="p-4">
                    {rl.is_blocked ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        BLOCKED ({rl.blocked_by || 'AUTO'})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                        ALLOWED
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-gray-400">{rl.block_reason || '-'}</td>
                  <td className="p-4 text-right">
                    {rl.is_blocked && (
                      <button
                        onClick={() => handleUnblockIp(rl.client_ip)}
                        className="px-3 py-1 bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-xs font-semibold ml-auto flex items-center gap-1"
                      >
                        <Unlock className="w-3 h-3" /> Unblock IP
                      </button>
                    )}
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
