'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, Users, FolderGit2, Rocket, Server, Activity, RefreshCw } from 'lucide-react';

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = async () => {
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    if (!token) return;

    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOverview(data.overview);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-surface to-surface border border-amber-500/20 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-400" /> System Admin Control Panel
          </h1>
          <p className="text-sm text-gray-400 mt-1">Platform-wide metrics, edge cluster health, global cache purge, and abuse management</p>
        </div>
        <button onClick={fetchOverview} className="p-2.5 bg-card text-gray-300 rounded-xl border border-border">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="text-xs text-gray-400 font-medium">Total Users</div>
          <div className="text-2xl font-bold text-white mt-1">{overview?.totalUsers || 0}</div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="text-xs text-gray-400 font-medium">Total Projects</div>
          <div className="text-2xl font-bold text-white mt-1">{overview?.totalProjects || 0}</div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="text-xs text-gray-400 font-medium">Global Cache Hit Ratio</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{overview?.requests?.globalHitRatio || 0}%</div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl">
          <div className="text-xs text-gray-400 font-medium">Avg Request Latency</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{overview?.requests?.avgLatencyMs || 0} ms</div>
        </div>
      </div>

      {/* Navigation Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/users" className="bg-surface border border-border hover:border-amber-500/50 p-6 rounded-xl transition">
          <Users className="w-8 h-8 text-amber-400 mb-3" />
          <h3 className="text-lg font-bold text-white">User Management</h3>
          <p className="text-xs text-gray-400 mt-1">Block / unblock developer accounts, review permissions</p>
        </Link>

        <Link href="/admin/edges" className="bg-surface border border-border hover:border-amber-500/50 p-6 rounded-xl transition">
          <Server className="w-8 h-8 text-cyan-400 mb-3" />
          <h3 className="text-lg font-bold text-white">Edge Node Cluster</h3>
          <p className="text-xs text-gray-400 mt-1">Monitor health, heartbeat, and trigger global cache purge</p>
        </Link>

        <Link href="/admin/rate-limits" className="bg-surface border border-border hover:border-amber-500/50 p-6 rounded-xl transition">
          <Activity className="w-8 h-8 text-red-400 mb-3" />
          <h3 className="text-lg font-bold text-white">Rate Limits & Firewall</h3>
          <p className="text-xs text-gray-400 mt-1">Audit Token Bucket limits, manage IP blacklist</p>
        </Link>
      </div>
    </div>
  );
}
