'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Rocket,
  RefreshCw,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Activity,
  Zap,
  GitPullRequest,
  GitBranch,
  GitMerge,
} from 'lucide-react';

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [repository, setRepository] = useState<any>(null);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [purging, setPurging] = useState(false);

  const [gitCommits, setGitCommits] = useState<any[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(false);

  // Try It Inspector State
  const [inspectResult, setInspectResult] = useState<any>(null);
  const [inspecting, setInspecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'deployments' | 'commits' | 'inspector'>('deployments');

  const fetchProjectData = async () => {
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    if (!token) return;

    try {
      const res = await fetch(`/api/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        router.push('/projects');
        return;
      }
      const data = await res.json();
      setProject(data.project);
      setRepository(data.repository);

      const depRes = await fetch(`/api/projects/${id}/deployments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (depRes.ok) {
        const depData = await depRes.json();
        setDeployments(depData.deployments || []);
      }

      // Fetch live Git Commits from repository
      setLoadingCommits(true);
      const commitRes = await fetch(`/api/projects/${id}/commits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (commitRes.ok) {
        const commitData = await commitRes.json();
        setGitCommits(commitData.commits || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingCommits(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const handleTriggerDeploy = async (type: 'deploy' | 'redeploy', commitSha?: string, commitMessage?: string) => {
    setDeploying(true);
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    try {
      const res = await fetch(`/api/projects/${id}/${type}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commitSha, commitMessage }),
      });
      const data = await res.json();
      if (res.ok && data.deployment) {
        router.push(`/projects/${id}/deployments/${data.deployment.id}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeploying(false);
    }
  };

  const handleTriggerPrPreview = async () => {
    setDeploying(true);
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    const randomPr = Math.floor(Math.random() * 90) + 10;
    try {
      const res = await fetch(`/api/projects/${id}/pr-preview`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prNumber: randomPr, branch: `feature/pr-${randomPr}` }),
      });
      const data = await res.json();
      if (res.ok && data.deployment) {
        router.push(`/projects/${id}/deployments/${data.deployment.id}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeploying(false);
    }
  };

  const handleMergePr = async (prNumber: number, commitSha?: string) => {
    if (!window.confirm(`Are you sure you want to merge PR #${prNumber} into main and deploy to Production?`)) return;

    setDeploying(true);
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    try {
      const res = await fetch(`/api/projects/${id}/merge-pr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prNumber, commitSha }),
      });
      const data = await res.json();
      if (res.ok && data.deployment) {
        router.push(`/projects/${id}/deployments/${data.deployment.id}`);
      } else {
        alert(data.error?.message || 'Failed to merge PR');
      }
    } catch (err: any) {
      alert('Error merging PR: ' + err.message);
    } finally {
      setDeploying(false);
    }
  };

  const handlePurgeCache = async () => {
    setPurging(true);
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    try {
      await fetch(`/api/projects/${id}/purge-cache`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Cache purge signal broadcasted to all edge nodes!');
    } catch (err) {
      console.error(err);
    } finally {
      setPurging(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm(`Are you sure you want to delete project "${project?.name}"? This action cannot be undone.`)) {
      return;
    }

    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        router.push('/projects');
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to delete project');
      }
    } catch (err: any) {
      alert('Error deleting project: ' + err.message);
    }
  };

  const handleInspectSite = async () => {
    setInspecting(true);
    setInspectResult(null);
    try {
      const startTime = Date.now();
      const res = await fetch(`http://localhost:8080/serve/${id}/index.html`, { cache: 'no-store' });
      const latency = Date.now() - startTime;
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const cacheStatus = res.headers.get('x-cache') || res.headers.get('X-Cache') || 'MISS';
      const edgeNode = res.headers.get('x-edge-node') || res.headers.get('X-Edge-Node') || 'edge-1';

      setInspectResult({
        status: res.status,
        latencyMs: latency,
        cacheStatus: cacheStatus.toUpperCase(),
        edgeNode: edgeNode,
        etag: res.headers.get('etag') || res.headers.get('ETag') || 'N/A',
        contentType: res.headers.get('content-type') || 'text/html',
      });
    } catch (err: any) {
      setInspectResult({ error: err.message });
    } finally {
      setInspecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-border p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
              {project.slug}.localhost
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Repository: <span className="font-mono text-gray-300">{repository?.repo_url || 'Local Fixture'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTriggerDeploy('deploy')}
            disabled={deploying}
            className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brandHover text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            <Rocket className="w-4 h-4" /> Trigger Deploy
          </button>
          <button
            onClick={handleTriggerPrPreview}
            disabled={deploying}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 text-xs font-semibold rounded-xl border border-purple-500/30 transition disabled:opacity-50"
          >
            <GitPullRequest className="w-3.5 h-3.5" /> PR Preview
          </button>
          <button
            onClick={handlePurgeCache}
            disabled={purging}
            className="px-3 py-2 bg-card hover:bg-gray-700 text-xs text-amber-300 border border-amber-500/30 font-medium rounded-xl transition"
          >
            Purge CDN Cache
          </button>
          <Link
            href={`/projects/${id}/analytics`}
            className="px-3 py-2 bg-card hover:bg-gray-700 text-xs text-gray-300 border border-border font-medium rounded-xl transition flex items-center gap-1"
          >
            <Activity className="w-3.5 h-3.5" /> Analytics
          </Link>
          <button
            onClick={handleDeleteProject}
            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-xs text-red-400 border border-red-500/30 font-medium rounded-xl transition flex items-center gap-1"
            title="Delete Project"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab('deployments')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'deployments'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'bg-card text-gray-400 hover:text-white border border-border hover:bg-surface'
          }`}
        >
          <Clock className="w-4 h-4" /> Deployment History ({deployments.length})
        </button>

        <button
          onClick={() => setActiveTab('commits')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'commits'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
              : 'bg-card text-gray-400 hover:text-white border border-border hover:bg-surface'
          }`}
        >
          <GitBranch className="w-4 h-4" /> Git Commits ({gitCommits.length})
        </button>

        <button
          onClick={() => setActiveTab('inspector')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'inspector'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
              : 'bg-card text-gray-400 hover:text-white border border-border hover:bg-surface'
          }`}
        >
          <Zap className="w-4 h-4" /> Live CDN Inspector
        </button>
      </div>

      {/* TAB 1: Deployment History */}
      {activeTab === 'deployments' && (
        <div className="bg-surface border border-border p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" /> Deployment History ({deployments.length})
            </h2>
            <button onClick={fetchProjectData} className="p-1.5 text-gray-400 hover:text-white">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {deployments.length === 0 ? (
            <div className="text-center p-8 text-sm text-gray-400">No deployments yet for this project.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-gray-400 uppercase text-[10px]">
                  <tr>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Commit SHA</th>
                    <th className="pb-3">Commit Message</th>
                    <th className="pb-3">Trigger</th>
                    <th className="pb-3">Created At</th>
                    <th className="pb-3 text-right">Logs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {deployments.map((dep) => (
                    <tr key={dep.id} className="hover:bg-card/50 transition">
                      <td className="py-3">
                        {dep.status === 'SUCCESS' && (
                          <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-semibold border border-green-500/30">
                            SUCCESS
                          </span>
                        )}
                        {dep.status === 'BUILDING' && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/30 animate-pulse">
                            BUILDING...
                          </span>
                        )}
                        {dep.status === 'QUEUED' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/30">
                            QUEUED
                          </span>
                        )}
                        {dep.status === 'FAILED' && (
                          <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold border border-red-500/30">
                            FAILED
                          </span>
                        )}
                      </td>
                      <td className="py-3 font-mono text-cyan-400 font-bold">{dep.commit_sha?.substring(0, 7) || 'N/A'}</td>
                      <td className="py-3 text-white font-medium max-w-xs truncate">{dep.commit_message || 'No commit message'}</td>
                      <td className="py-3 font-mono text-gray-400">
                        {dep.trigger === 'PULL_REQUEST' ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40 text-[10px]">
                              PR #{dep.pr_number || 1}
                            </span>
                            {dep.status === 'SUCCESS' && (
                              <>
                                <a
                                  href={`http://localhost:8080/serve/${id}/pr/${dep.pr_number || 1}/`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-purple-400 hover:underline font-bold flex items-center gap-0.5"
                                >
                                  Preview <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                                {dep.commit_message?.startsWith('[MERGED]') ? (
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-500/30 flex items-center gap-1">
                                    <GitMerge className="w-2.5 h-2.5 text-green-400" /> Merged
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleMergePr(dep.pr_number || 1, dep.commit_sha)}
                                    disabled={deploying}
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-green-600/30 hover:bg-green-600 text-green-300 hover:text-white border border-green-500/30 flex items-center gap-1 transition disabled:opacity-50"
                                    title="Merge PR into Main & Deploy to Production"
                                  >
                                    <GitMerge className="w-2.5 h-2.5" /> Merge to Main 🔀
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          dep.trigger
                        )}
                      </td>
                      <td className="py-3 text-gray-400">{new Date(dep.created_at).toLocaleString()}</td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/projects/${id}/deployments/${dep.id}`}
                          className="text-blue-400 hover:underline font-mono text-xs font-semibold flex items-center justify-end gap-1"
                        >
                          <Terminal className="w-3.5 h-3.5" /> View Terminal
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Recent Git Commits */}
      {activeTab === 'commits' && (
        <div className="bg-surface border border-border p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-purple-400" /> Git Commits Stream ({gitCommits.length})
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Live commits fetched from linked GitHub repository ({project?.branch || 'main'})</p>
            </div>
            <button
              onClick={fetchProjectData}
              disabled={loadingCommits}
              className="p-1.5 text-gray-400 hover:text-white"
              title="Refresh Commits"
            >
              <RefreshCw className={`w-4 h-4 ${loadingCommits ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {gitCommits.length === 0 ? (
            <div className="text-center p-8 text-sm text-gray-400">No git commits found for this repository.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-gray-400 uppercase text-[10px]">
                  <tr>
                    <th className="pb-3">SHA</th>
                    <th className="pb-3">Commit Message</th>
                    <th className="pb-3">Author</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {gitCommits.map((c, index) => {
                    const latestMainDep = deployments.find((d) => (d.branch === (project?.branch || 'main') || !d.pr_number) && d.status === 'SUCCESS');
                    const existingDep = deployments.find(
                      (d) =>
                        d.commit_sha === c.sha ||
                        (d.commit_sha && c.sha && (d.commit_sha.startsWith(c.shortSha) || c.sha.startsWith(d.commit_sha.substring(0, 7)))) ||
                        (index === 0 && d.id === latestMainDep?.id)
                    );
                    const isDeployed = existingDep && existingDep.status === 'SUCCESS';
                    const isBuilding = existingDep && (existingDep.status === 'BUILDING' || existingDep.status === 'QUEUED');
                    const isFailed = existingDep && existingDep.status === 'FAILED';

                    return (
                      <tr key={c.sha} className="hover:bg-card/50 transition">
                        <td className="py-3 font-mono font-bold text-cyan-400">
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                            {c.shortSha} <ExternalLink className="w-3 h-3 text-gray-500" />
                          </a>
                        </td>
                        <td className="py-3 text-white font-medium max-w-md truncate">
                          <div className="flex items-center gap-2">
                            {c.pr_number && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40 text-[10px] shrink-0">
                                PR #{c.pr_number}
                              </span>
                            )}
                            <span className="truncate">{c.message}</span>
                          </div>
                        </td>
                        <td className="py-3 text-gray-400">{c.author}</td>
                        <td className="py-3 text-gray-400">{new Date(c.date).toLocaleString()}</td>
                        <td className="py-3 text-right">
                          {isDeployed ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/30 rounded-lg text-xs font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Deployed
                            </span>
                          ) : isBuilding ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold animate-pulse">
                              <Clock className="w-3.5 h-3.5" /> Building...
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                c.pr_number
                                  ? handleMergePr(c.pr_number, c.sha)
                                  : handleTriggerDeploy('deploy', c.sha, c.message)
                              }
                              disabled={deploying}
                              className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                            >
                              Deploy This Commit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Live CDN Inspector */}
      {activeTab === 'inspector' && (
        <div className="bg-surface border border-border p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> Live CDN Inspector (&quot;Try It&quot;)
            </h2>
            <button
              onClick={handleInspectSite}
              disabled={inspecting}
              className="px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-xs font-semibold rounded-lg border border-blue-500/30 transition flex items-center gap-1"
            >
              {inspecting ? 'Probing...' : 'Fetch via Gateway (:8080)'}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Probes Gateway load balancer to inspect live response headers (<span className="text-blue-400 font-mono">X-Cache: HIT/MISS</span>, <span className="text-blue-400 font-mono">X-Edge-Node</span>).
          </p>

          {inspectResult && (
            <div className="bg-card p-4 rounded-xl border border-border space-y-2 font-mono text-xs">
              {inspectResult.error ? (
                <div className="text-red-400">Error: {inspectResult.error}</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-gray-300">
                  <div>
                    <div className="text-gray-500 text-[10px] uppercase">Status</div>
                    <div className="font-bold text-green-400">{inspectResult.status} OK</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-[10px] uppercase">X-Cache Status</div>
                    <div className={`font-bold ${inspectResult.cacheStatus === 'HIT' ? 'text-green-400' : 'text-amber-400'}`}>
                      {inspectResult.cacheStatus}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-[10px] uppercase">Served By Edge</div>
                    <div className="font-bold text-cyan-400">{inspectResult.edgeNode}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-[10px] uppercase">Response Latency</div>
                    <div className="font-bold text-white">{inspectResult.latencyMs} ms</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
