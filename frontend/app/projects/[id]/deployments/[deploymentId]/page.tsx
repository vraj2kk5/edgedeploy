'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Terminal, ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function DeploymentTerminalPage({
  params,
}: {
  params: Promise<{ id: string; deploymentId: string }>;
}) {
  const { id, deploymentId } = use(params);
  const router = useRouter();
  const [deployment, setDeployment] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    const token = localStorage.getItem('edgedeploy_token');
    if (!token) return;

    try {
      const depRes = await fetch(`/api/deployments/${deploymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (depRes.ok) {
        const depData = await depRes.json();
        setDeployment(depData.deployment);
      }

      const logRes = await fetch(`/api/deployments/${deploymentId}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (logRes.ok) {
        const logData = await logRes.json();
        setLogs(logData.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => {
      if (deployment?.status === 'QUEUED' || deployment?.status === 'BUILDING') {
        fetchLogs();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [deploymentId, deployment?.status]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${id}`}
            className="p-2 bg-card hover:bg-gray-700 text-gray-300 rounded-xl border border-border transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Deployment #{deploymentId} Terminal
            </h1>
            <p className="text-xs text-gray-400 font-mono">
              Commit: {deployment?.commit_sha} ({deployment?.branch})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {deployment?.status === 'SUCCESS' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> SUCCESS
            </span>
          )}
          {deployment?.status === 'BUILDING' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> BUILDING...
            </span>
          )}
          {deployment?.status === 'FAILED' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> FAILED
            </span>
          )}
          <button onClick={fetchLogs} className="p-2 bg-card text-gray-300 rounded-xl border border-border">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Output Panel */}
      <div className="bg-black/90 border border-gray-800 rounded-2xl p-6 font-mono text-xs overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4 text-gray-500 text-[11px]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-400" />
            <span>edgedeploy-build-runner-worker</span>
          </div>
          <div>Logs count: {logs.length}</div>
        </div>

        <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-2">
          {logs.length === 0 ? (
            <div className="text-gray-500 italic">Waiting for build logs...</div>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="flex items-start gap-3">
                <span className="text-gray-600 select-none text-[10px] w-8">{l.seq}</span>
                <span
                  className={
                    l.stream === 'STDERR'
                      ? 'text-red-400'
                      : l.stream === 'SYSTEM'
                      ? 'text-cyan-400 font-semibold'
                      : 'text-gray-300'
                  }
                >
                  [{l.stream}] {l.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
