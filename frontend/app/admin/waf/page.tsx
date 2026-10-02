'use client';

import React, { useEffect, useState } from 'react';
import { Shield, RefreshCw, AlertTriangle, CheckCircle2, Zap, ExternalLink, Lock } from 'lucide-react';

export default function WafAdminPage() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchWafData = async () => {
    setLoading(true);
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    if (!token) return;

    try {
      const res = await fetch('/api/admin/waf-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWafData();
    const interval = setInterval(fetchWafData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-border p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 text-green-400 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                Edge WAF Security & Threat Inspector
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Sub-millisecond Edge Threat Protection, SQLi / XSS Interception, and Bot Mitigation across all Edge Nodes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> WAF Shield ACTIVE 🛡️
          </span>
          <button
            onClick={fetchWafData}
            disabled={loading}
            className="p-2 bg-card text-gray-300 rounded-xl border border-border hover:bg-gray-700 transition"
            title="Refresh Threats"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border p-5 rounded-2xl space-y-1">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Threats Blocked</div>
          <div className="text-2xl font-extrabold text-red-400">{summary?.totalBlocked || 0}</div>
          <div className="text-[11px] text-gray-500">Sub-millisecond Gateway Drops</div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-2xl space-y-1">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">WAF Engine Status</div>
          <div className="text-2xl font-extrabold text-green-400">100% ONLINE</div>
          <div className="text-[11px] text-gray-500">Sub-millisecond Inspection</div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-2xl space-y-1">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Rule Engines</div>
          <div className="text-xl font-bold text-cyan-400">SQLi, XSS, Path, Bots</div>
          <div className="text-[11px] text-gray-500">Regex & Pattern Matching</div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-2xl space-y-1 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Live Threat Test</div>
            <div className="text-xs text-gray-300 font-semibold mt-1">Simulate Threat Interception</div>
          </div>
          <button
            onClick={() => window.open('http://localhost:8080/health?sqli=UNION+SELECT', '_blank')}
            className="w-full py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" /> Test SQLi Block 🛡️
          </button>
        </div>
      </div>

      {/* Threats Breakdown */}
      {summary?.threatsByType && summary.threatsByType.length > 0 && (
        <div className="bg-surface border border-border p-6 rounded-2xl space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider text-gray-400">
            Threat Category Distribution
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summary.threatsByType.map((t: any) => (
              <div key={t.threat_type} className="bg-card p-4 rounded-xl border border-border">
                <div className="text-xs font-bold text-red-400">{t.threat_type}</div>
                <div className="text-xl font-extrabold text-white mt-1">{t.count} Blocked</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intercepted Threats Table */}
      <div className="bg-surface border border-border p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" /> Recent Intercepted Threat Logs ({summary?.recentThreats?.length || 0})
          </h2>
          <p className="text-xs text-gray-400 font-mono">Live threats dropped by Gateway before origin or edge execution</p>
        </div>

        {summary?.recentThreats?.length === 0 ? (
          <div className="text-center p-8 text-sm text-gray-400">
            No threats detected yet! Edge WAF Shield is monitoring all incoming traffic.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-border text-gray-400 uppercase text-[10px]">
                <tr>
                  <th className="pb-3">Client IP</th>
                  <th className="pb-3">Target Project</th>
                  <th className="pb-3">Threat Category</th>
                  <th className="pb-3">Intercepted URL Path</th>
                  <th className="pb-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {summary?.recentThreats?.map((t: any) => (
                  <tr key={t.id} className="hover:bg-card/50 transition">
                    <td className="py-3 font-bold text-cyan-400">{t.client_ip}</td>
                    <td className="py-3 text-gray-300 font-semibold">{t.project_name || 'Global Gateway'}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/40 text-[10px]">
                        {t.threat_type}
                      </span>
                    </td>
                    <td className="py-3 text-gray-300 max-w-xs truncate" title={t.path}>
                      {t.path}
                    </td>
                    <td className="py-3 text-right text-gray-400">{new Date(t.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
