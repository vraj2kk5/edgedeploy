'use client';

import React, { useEffect, useState } from 'react';
import { Radio, Search, Filter, RefreshCw, Zap, Clock, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function AdminRequestLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, success: 0, rateLimited: 0, avgLatencyMs: 0 });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cacheFilter, setCacheFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (cacheFilter !== 'ALL') params.append('cache', cacheFilter);
      if (search.trim()) params.append('search', search.trim());

      const res = await fetch(`/api/admin/request-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter, cacheFilter]);

  useEffect(() => {
    let interval: any = null;
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, statusFilter, cacheFilter, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-cyan-400 animate-pulse" /> Edge Traffic Inspector & Request Logs
          </h1>
          <p className="text-sm text-gray-400 mt-1">Real-time HTTP traffic stream across edge nodes and rate limits</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border ${
              autoRefresh
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : 'bg-card text-gray-400 border-border hover:bg-surface'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Live Auto-Refresh (3s)' : 'Paused'}
          </button>
          <button
            onClick={fetchLogs}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border p-4 rounded-2xl">
          <p className="text-xs font-semibold text-gray-400">Total HTTP Requests</p>
          <p className="text-2xl font-bold text-white mt-1 font-mono">{stats.total}</p>
        </div>
        <div className="bg-surface border border-border p-4 rounded-2xl">
          <p className="text-xs font-semibold text-green-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Successful (2xx)
          </p>
          <p className="text-2xl font-bold text-green-400 mt-1 font-mono">{stats.success}</p>
        </div>
        <div className="bg-surface border border-border p-4 rounded-2xl">
          <p className="text-xs font-semibold text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Rate Limited (429)
          </p>
          <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">{stats.rateLimited}</p>
        </div>
        <div className="bg-surface border border-border p-4 rounded-2xl">
          <p className="text-xs font-semibold text-cyan-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Avg Edge Latency
          </p>
          <p className="text-2xl font-bold text-cyan-400 mt-1 font-mono">{stats.avgLatencyMs} ms</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface border border-border p-4 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search IP, Path, Host..."
              className="w-full pl-9 pr-4 py-1.5 bg-card border border-border rounded-xl text-white text-xs font-mono"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-card border border-border hover:bg-surface text-gray-300 text-xs font-semibold rounded-xl">
            Filter
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-card border border-border p-1 rounded-xl text-xs">
            <span className="text-gray-400 px-2 font-semibold">Status:</span>
            {['ALL', '200', '429', '404'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Cache Filter */}
          <div className="flex items-center gap-1 bg-card border border-border p-1 rounded-xl text-xs">
            <span className="text-gray-400 px-2 font-semibold">Cache:</span>
            {['ALL', 'HIT', 'MISS', 'NONE'].map((c) => (
              <button
                key={c}
                onClick={() => setCacheFilter(c)}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition ${
                  cacheFilter === c
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center text-gray-400">
          No request logs found matching criteria.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-card border-b border-border text-gray-400 uppercase text-[10px]">
                <tr>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Method & Path</th>
                  <th className="p-4">Client IP</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Cache</th>
                  <th className="p-4">Edge Node</th>
                  <th className="p-4 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-card/50 transition">
                    <td className="p-4 text-gray-400 text-[11px]">
                      {new Date(log.ts).toLocaleTimeString()}
                    </td>
                    <td className="p-4 text-white max-w-xs truncate">
                      <span className="text-blue-400 font-bold mr-2">{log.method}</span>
                      <span className="text-gray-200">{log.path}</span>
                    </td>
                    <td className="p-4 text-cyan-400">{log.client_ip}</td>
                    <td className="p-4">
                      {log.status_code >= 200 && log.status_code < 300 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                          {log.status_code} OK
                        </span>
                      ) : log.status_code === 429 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          429 RATE LIMITED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                          {log.status_code}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {log.cache_result === 'HIT' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          HIT
                        </span>
                      ) : log.cache_result === 'MISS' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          MISS
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">
                          NONE
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-300">
                      {log.edge_name ? `${log.edge_name} (${log.edge_region})` : '-'}
                    </td>
                    <td className="p-4 text-right text-cyan-400 font-bold">
                      {log.latency_ms} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
