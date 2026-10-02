'use client';

import React, { useEffect, useState } from 'react';
import { Server, RefreshCw, Trash2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function AdminEdgesPage() {
  const [edges, setEdges] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);

  const fetchEdgeData = async () => {
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const [edgeRes, healthRes] = await Promise.all([
        fetch('/api/admin/edges', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/health', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (edgeRes.ok && healthRes.ok) {
        const edgeData = await edgeRes.json();
        const healthData = await healthRes.json();
        setEdges(edgeData.edges || []);
        setHealth(healthData.health || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEdgeData();
    const interval = setInterval(fetchEdgeData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleGlobalPurge = async () => {
    if (!confirm('Are you sure you want to purge cache across ALL edge nodes?')) return;
    setPurging(true);
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    try {
      const res = await fetch('/api/admin/cache/purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scope: 'all' }),
      });
      const data = await res.json();
      alert(`Global cache purge complete! Purged ${data.purgedCount || 0} entries.`);
      fetchEdgeData();
    } catch (err) {
      console.error(err);
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Server className="w-6 h-6 text-cyan-400" /> Edge Node Cluster & Cache Controls
          </h1>
          <p className="text-sm text-gray-400 mt-1">Real-time process health, active ports, regions, and cache entry counts</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleGlobalPurge}
            disabled={purging}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-red-600/20 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> Global Purge All Cache
          </button>
          <button onClick={fetchEdgeData} className="p-2 bg-card text-gray-300 rounded-xl border border-border">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {health.map((hNode) => (
            <div key={hNode.id} className="bg-surface border border-border p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">{hNode.name}</h3>
                  <div className="text-xs text-gray-400 font-mono">Port :{hNode.port}</div>
                </div>

                {hNode.status === 'HEALTHY' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> HEALTHY
                  </span>
                )}
                {hNode.status === 'UNHEALTHY' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> UNHEALTHY
                  </span>
                )}
                {hNode.status === 'OFFLINE' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> OFFLINE
                  </span>
                )}
              </div>

              <div className="bg-card p-3 rounded-xl border border-border text-xs space-y-1.5 font-mono text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-400">Simulated Region:</span>
                  <span className="text-cyan-400 font-semibold">{hNode.region}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cache Entries:</span>
                  <span className="text-white font-bold">{hNode.details?.cacheEntries || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Process Uptime:</span>
                  <span>{hNode.details?.uptime ? `${Math.floor(hNode.details.uptime)} s` : 'N/A'}</span>
                </div>
              </div>

              {/* Cached Files Breakdown */}
              {hNode.details?.cachedItems && hNode.details.cachedItems.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Cached Files ({hNode.details.cachedItems.length}):
                  </p>
                  <div className="space-y-1 bg-card/60 p-2.5 rounded-xl border border-border text-[11px] font-mono">
                    {hNode.details.cachedItems.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-gray-300 border-b border-border/40 last:border-0 pb-1 last:pb-0">
                        <span className="text-cyan-400 truncate max-w-[170px]" title={item.cacheKey}>
                          {item.cacheKey}
                        </span>
                        <span className="text-gray-400 text-[10px]">
                          ({(item.sizeBytes / 1024).toFixed(1)} KB, {item.hitCount} hits)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
