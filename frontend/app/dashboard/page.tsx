'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FolderGit2,
  Rocket,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProjects = async () => {
    const token = sessionStorage.getItem('edgedeploy_token') || localStorage.getItem('edgedeploy_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('edgedeploy_token');
        router.push('/login');
        return;
      }
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/40 via-surface to-surface border border-blue-500/20 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Developer Overview <Zap className="w-5 h-5 text-blue-400" />
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage static web projects, monitor edge CDN traffic, and view live build pipelines.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/projects/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brandHover text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" /> New Project
          </Link>
          <button
            onClick={fetchProjects}
            className="p-2.5 bg-card hover:bg-gray-700 text-gray-300 border border-border rounded-xl transition"
            title="Refresh projects"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Total Projects</div>
            <div className="text-2xl font-bold text-white">{projects.length}</div>
          </div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Active Sites</div>
            <div className="text-2xl font-bold text-white">
              {projects.filter((p) => p.active_deployment_id).length}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Edge CDN Nodes</div>
            <div className="text-2xl font-bold text-white">3 Active</div>
          </div>
        </div>

        <div className="bg-surface border border-border p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Gateway LB</div>
            <div className="text-sm font-semibold text-cyan-400">Token Bucket :8080</div>
          </div>
        </div>
      </div>

      {/* Projects List Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          Your Projects ({projects.length})
        </h2>

        {loading ? (
          <div className="flex justify-center p-8 bg-surface border border-border rounded-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center p-12 bg-surface border border-border rounded-xl">
            <FolderGit2 className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-300">No projects yet</h3>
            <p className="text-sm text-gray-400 mb-4">Create your first static site project to deploy to EdgeDeploy CDN.</p>
            <Link
              href="/projects/new"
              className="px-4 py-2 bg-brand hover:bg-brandHover text-white font-semibold text-sm rounded-xl transition inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-surface border border-border hover:border-gray-600 p-6 rounded-xl transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-lg font-bold text-white hover:text-blue-400 transition"
                      >
                        {project.name}
                      </Link>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">{project.slug}.localhost</div>
                    </div>
                    {project.active_deployment_id ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> LIVE
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/30 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> UNBUILT
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-gray-400 space-y-1 my-3 bg-card/60 p-3 rounded-lg border border-border/40 font-mono">
                    <div>Build Command: <span className="text-gray-200">{project.build_command}</span></div>
                    <div>Output Dir: <span className="text-gray-200">{project.output_directory}</span></div>
                    <div>Branch: <span className="text-gray-200">{project.branch}</span></div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border/60">
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-xs text-blue-400 hover:underline font-semibold flex items-center gap-1"
                  >
                    View Details & Logs →
                  </Link>

                  <a
                    href={`http://localhost:8080/serve/${project.id}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-card hover:bg-gray-700 text-xs text-gray-300 font-medium rounded-lg border border-border flex items-center gap-1 transition"
                  >
                    Visit Live Site <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
