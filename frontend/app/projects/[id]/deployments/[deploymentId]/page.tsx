'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Terminal, ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, ExternalLink, GitMerge } from 'lucide-react';

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
  const [merging, setMerging] = useState(false);

  const fetchLogs = async () => {
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
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

  const handleMergePr = async () => {
    if (!deployment?.pr_number) return;
    if (!window.confirm(`Are you sure you want to merge PR #${deployment.pr_number} into main and deploy to Production?`)) return;

    setMerging(true);
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    try {
      const res = await fetch(`/api/projects/${id}/merge-pr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prNumber: deployment.pr_number,
          commitSha: deployment.commit_sha,
        }),
      });
      const data = await res.json();
      if (res.ok && data.deployment) {
        alert(data.message || 'Successfully merged into main! Redirecting to Production Deployment...');
        router.push(`/projects/${id}/deployments/${data.deployment.id}`);
      } else {
        alert(data.error?.message || 'Failed to merge PR');
      }
    } catch (err: any) {
      alert('Error merging PR: ' + err.message);
    } finally {
      setMerging(false);
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

  const isMerged = deployment?.commit_message?.startsWith('[MERGED]');
  const isMergeProductionDeploy = deployment?.commit_message?.includes('Merge Pull Request');

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
              {isMergeProductionDeploy
                ? `Production Deployment #${deploymentId} (Merged PR)`
                : `Deployment #${deploymentId} Terminal`}
            </h1>
            <p className="text-xs text-gray-400 font-mono">
              Commit: {deployment?.commit_sha} ({deployment?.branch})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {deployment?.status === 'SUCCESS' && (
            <>
              {deployment?.pr_number ? (
                <>
                  <a
                    href={`http://localhost:8080/serve/${id}/pr/${deployment.pr_number}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 transition shadow-lg shadow-purple-600/20"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Visit PR #{deployment.pr_number} Preview ↗
                  </a>
                  {isMerged ? (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/40 flex items-center gap-1.5">
                      <GitMerge className="w-3.5 h-3.5 text-green-400" /> ✓ Merged into Main
                    </span>
                  ) : (
                    <button
                      onClick={handleMergePr}
                      disabled={merging}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-500 text-white flex items-center gap-1.5 transition shadow-lg shadow-green-600/20 disabled:opacity-50"
                    >
                      <GitMerge className="w-3.5 h-3.5" /> {merging ? 'Merging...' : 'Merge PR to Main 🔀'}
                    </button>
                  )}
                </>
              ) : (
                <a
                  href={`http://localhost:8080/serve/${id}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition shadow-lg shadow-blue-600/20"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Visit Live Site ↗
                </a>
              )}
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> SUCCESS
              </span>
            </>
          )}
          {deployment?.status === 'BUILDING' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> BUILDING...
            </span>
          )}
          {deployment?.status === 'QUEUED' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> QUEUED...
            </span>
          )}
          {deployment?.status === 'FAILED' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> FAILED
            </span>
          )}
          <button onClick={fetchLogs} className="p-2 bg-card text-gray-300 rounded-xl border border-border" title="Refresh Logs">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isMergeProductionDeploy && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
            <GitMerge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">🔀 Deploying Merged PR to Production</h3>
            <p className="text-xs text-gray-300">
              The pull request changes have been merged into <span className="font-mono text-cyan-400">{deployment.branch}</span> and are being published to your live production site (<a href={`http://localhost:8080/serve/${id}/`} target="_blank" rel="noreferrer" className="text-blue-400 underline font-mono">http://localhost:8080/serve/{id}/</a>).
            </p>
          </div>
        </div>
      )}

      {deployment?.status === 'SUCCESS' && !isMergeProductionDeploy && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 text-green-400 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isMerged
                  ? `✓ PR Preview #${deployment.pr_number} Merged into Main!`
                  : deployment.pr_number
                  ? `PR Preview #${deployment.pr_number} Ready!`
                  : 'Deployment Successfully Live!'}
              </h3>
              <p className="text-xs text-gray-400">
                URL:{' '}
                <a
                  href={
                    deployment.pr_number
                      ? `http://localhost:8080/serve/${id}/pr/${deployment.pr_number}/`
                      : `http://localhost:8080/serve/${id}/`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline font-mono"
                >
                  {deployment.pr_number
                    ? `http://localhost:8080/serve/${id}/pr/${deployment.pr_number}/`
                    : `http://localhost:8080/serve/${id}/`}
                </a>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={
                deployment.pr_number
                  ? `http://localhost:8080/serve/${id}/pr/${deployment.pr_number}/`
                  : `http://localhost:8080/serve/${id}/`
              }
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-purple-600/20"
            >
              <ExternalLink className="w-4 h-4" /> Open Site
            </a>
            {deployment.pr_number && (
              isMerged ? (
                <span className="px-4 py-2 bg-green-600/20 text-green-300 font-semibold text-xs rounded-xl flex items-center gap-1.5 border border-green-500/30">
                  <GitMerge className="w-4 h-4 text-green-400" /> ✓ Merged into Main
                </span>
              ) : (
                <button
                  onClick={handleMergePr}
                  disabled={merging}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-green-600/20 disabled:opacity-50"
                >
                  <GitMerge className="w-4 h-4" /> {merging ? 'Merging...' : 'Merge to Main 🔀'}
                </button>
              )
            )}
          </div>
        </div>
      )}

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
