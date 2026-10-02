'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Activity, Zap, Clock } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from 'recharts';

export default function ProjectAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [summary, setSummary] = useState<any>(null);
  const [traffic, setTraffic] = useState<any[]>([]);
  const [latency, setLatency] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    if (!token) return;

    Promise.all([
      fetch(`/api/projects/${id}/analytics`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`/api/projects/${id}/analytics/traffic`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`/api/projects/${id}/analytics/latency`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([sumData, trafData, latData]) => {
        setSummary(sumData.summary);
        setTraffic(trafData.traffic || []);
        setLatency(latData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href={`/projects/${id}`} className="p-2 bg-card hover:bg-gray-700 text-gray-300 rounded-xl border border-border">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" /> Project Analytics & Traffic
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Real-time edge metrics, cache hit ratio, and latency comparison</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="text-xs text-gray-400">Total CDN Requests</div>
          <div className="text-2xl font-bold text-white mt-1">{summary?.totalRequests || 0}</div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="text-xs text-gray-400">Cache Hit Ratio</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{summary?.hitRatio || 0}%</div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="text-xs text-gray-400">Avg Latency</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{summary?.avgLatencyMs || 0} ms</div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="text-xs text-gray-400">Total Deployments</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{summary?.deployments?.total || 0}</div>
        </div>
      </div>

      {/* Latency Comparison Card */}
      <div className="bg-surface border border-border p-6 rounded-2xl space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" /> Latency Comparison (Cache HIT vs MISS)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          <div className="bg-card p-4 rounded-xl border border-green-500/20">
            <div className="text-green-400 font-bold text-sm mb-2">Cache HIT (Edge Served)</div>
            <div className="space-y-1 text-gray-300">
              <div>Average Latency: <span className="font-bold text-white">{latency?.hit?.avg || 0} ms</span></div>
              <div>Min Latency: <span className="text-gray-400">{latency?.hit?.min || 0} ms</span></div>
              <div>Max Latency: <span className="text-gray-400">{latency?.hit?.max || 0} ms</span></div>
            </div>
          </div>

          <div className="bg-card p-4 rounded-xl border border-amber-500/20">
            <div className="text-amber-400 font-bold text-sm mb-2">Cache MISS (Origin Served)</div>
            <div className="space-y-1 text-gray-300">
              <div>Average Latency: <span className="font-bold text-white">{latency?.miss?.avg || 0} ms</span></div>
              <div>Min Latency: <span className="text-gray-400">{latency?.miss?.min || 0} ms</span></div>
              <div>Max Latency: <span className="text-gray-400">{latency?.miss?.max || 0} ms</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
