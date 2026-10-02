'use client';

import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, Lock, Unlock, Zap, Gauge, RefreshCw, AlertCircle } from 'lucide-react';

export default function AdminRateLimitsPage() {
  const [rateLimits, setRateLimits] = useState<any[]>([]);
  const [policy, setPolicy] = useState<{ capacity: number; refillPerSec: number; windowSeconds: number }>({
    capacity: 10,
    refillPerSec: 2,
    windowSeconds: 60,
  });
  const [ipToBlock, setIpToBlock] = useState('');
  const [reason, setReason] = useState('Abuse / Excess requests');
  const [loading, setLoading] = useState(true);

  const fetchRateLimits = async () => {
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/rate-limits', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRateLimits(data.rateLimits || []);
        if (data.policy) {
          setPolicy(data.policy);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRateLimits();
    const interval = setInterval(fetchRateLimits, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleBlockIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipToBlock) return;
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
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
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-red-400" /> Gateway Rate Limiter Audit & Firewall
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Monitor active Token Bucket rates, enforce IP blocklists, and view real-time traffic statistics.
          </p>
        </div>
        <button
          onClick={fetchRateLimits}
          className="px-3 py-1.5 bg-card hover:bg-card/80 border border-border text-gray-300 text-xs rounded-xl flex items-center gap-1.5 self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Live Metrics
        </button>
      </div>

      {/* Rate Limit Policy Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Zap className="w-4 h-4 text-amber-400" /> Burst Limit (Bucket Size)
          </div>
          <div className="text-2xl font-bold text-white">{policy.capacity} Req Burst</div>
          <div className="text-[11px] text-gray-400 mt-1">Max instant requests allowed before throttling</div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Gauge className="w-4 h-4 text-cyan-400" /> Refill Speed
          </div>
          <div className="text-2xl font-bold text-cyan-400">{policy.refillPerSec} Tokens / sec</div>
          <div className="text-[11px] text-gray-400 mt-1">Continuous bucket refill rate</div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Activity className="w-4 h-4 text-green-400" /> Max Sustained Rate
          </div>
          <div className="text-2xl font-bold text-green-400">{policy.refillPerSec * 60} Reqs / min</div>
          <div className="text-[11px] text-gray-400 mt-1">Sustained throughput baseline</div>
        </div>

        <div className="bg-surface border border-border p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <ShieldAlert className="w-4 h-4 text-red-400" /> Throttling Enforcement
          </div>
          <div className="text-2xl font-bold text-red-400">HTTP 429 + Retry</div>
          <div className="text-[11px] text-gray-400 mt-1">Automatic block on token depletion</div>
        </div>
      </div>

      {/* Manual IP Block Form */}
      <form onSubmit={handleBlockIp} className="bg-surface border border-border p-6 rounded-2xl flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-gray-300">Target Client IP</label>
            <button
              type="button"
              onClick={() => setIpToBlock('127.0.0.1')}
              className="text-[11px] text-cyan-400 hover:underline font-mono"
            >
              + Target Localhost (127.0.0.1)
            </button>
          </div>
          <input
            type="text"
            required
            value={ipToBlock}
            onChange={(e) => setIpToBlock(e.target.value)}
            placeholder="e.g. 127.0.0.1"
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
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card/40">
            <h2 className="font-semibold text-white text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" /> Client IP Rate Limit & Token Audit List
            </h2>
            <span className="text-xs text-gray-400">Total Monitored IPs: {rateLimits.length}</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-card border-b border-border text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="p-4">Client IP</th>
                <th className="p-4">Token Bucket State</th>
                <th className="p-4">Lifetime Traffic</th>
                <th className="p-4">Status</th>
                <th className="p-4">Reason</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rateLimits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    No active client IP rate limits or blocks recorded yet.
                  </td>
                </tr>
              ) : (
                rateLimits.map((rl) => {
                  const tokenVal = Number(rl.tokens || 0);
                  const maxTokens = policy.capacity || 10;
                  const tokenPercent = Math.min(100, Math.max(0, (tokenVal / maxTokens) * 100));

                  return (
                    <tr key={rl.id || rl.client_ip} className="hover:bg-card/50 transition">
                      <td className="p-4">
                        <div className="font-mono font-bold text-white text-sm">{rl.client_ip}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Policy: {policy.capacity} Burst | {policy.refillPerSec}/sec</div>
                      </td>

                      <td className="p-4 min-w-[200px]">
                        <div className="flex items-center justify-between text-xs font-mono mb-1">
                          <span className={tokenVal > 5 ? 'text-cyan-400' : tokenVal > 2 ? 'text-amber-400' : 'text-red-400'}>
                            {tokenVal.toFixed(1)} / {maxTokens.toFixed(1)} Tokens
                          </span>
                          <span className="text-[10px] text-gray-400">{tokenPercent.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-card rounded-full h-2 overflow-hidden border border-border">
                          <div
                            className={`h-full transition-all duration-300 ${
                              tokenVal > 5 ? 'bg-cyan-500' : tokenVal > 2 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${tokenPercent}%` }}
                          />
                        </div>
                      </td>

                      <td className="p-4 font-mono">
                        <div className="text-sm font-semibold text-white">{rl.request_count.toLocaleString()} reqs</div>
                        <div className="text-[10px] text-gray-400">Total historical requests</div>
                      </td>

                      <td className="p-4">
                        {rl.is_blocked ? (
                          <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            BLOCKED ({rl.blocked_by || 'ADMIN'})
                          </span>
                        ) : tokenVal < 1.0 ? (
                          <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            RATE LIMITED (429)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                            ALLOWED
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-gray-300">
                        {rl.is_blocked ? (
                          <span className="text-red-300 font-medium">{rl.block_reason || 'Blocked by Admin'}</span>
                        ) : tokenVal < 1.0 ? (
                          <span className="text-amber-300 font-medium">Tokens depleted (HTTP 429)</span>
                        ) : (
                          <span className="text-gray-400">Normal operations</span>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        {rl.is_blocked ? (
                          <button
                            onClick={() => handleUnblockIp(rl.client_ip)}
                            className="px-3 py-1.5 bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30 rounded-xl text-xs font-semibold ml-auto flex items-center gap-1 transition"
                          >
                            <Unlock className="w-3.5 h-3.5" /> Unblock IP
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setIpToBlock(rl.client_ip);
                              setReason('Manual Admin Block');
                            }}
                            className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-xs font-semibold ml-auto flex items-center gap-1 transition"
                          >
                            <Lock className="w-3.5 h-3.5" /> Block IP
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
