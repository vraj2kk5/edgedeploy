'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderGit2, Plus, CheckCircle2, Clock, ExternalLink, Trash2 } from 'lucide-react';

export default function ProjectsListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = () => {
    const token = localStorage.getItem('edgedeploy_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetch('/api/projects', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setProjects(data.projects || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, [router]);

  const handleDeleteProject = async (e: React.MouseEvent, projectId: number, projectName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete project "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    const token = localStorage.getItem('edgedeploy_token');
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to delete project');
      }
    } catch (err: any) {
      alert('Error deleting project: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm text-gray-400 mt-1">Manage your deployed applications and build settings</p>
        </div>

        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brandHover text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center p-12 bg-surface border border-border rounded-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="bg-surface border border-border p-6 rounded-xl hover:border-gray-600 transition flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/projects/${project.id}`} className="text-lg font-bold text-white hover:text-blue-400">
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

                <div className="my-4 text-xs text-gray-400 space-y-1 bg-card/60 p-3 rounded-lg border border-border/40 font-mono">
                  <div>Build: <span className="text-gray-200">{project.build_command}</span></div>
                  <div>Output: <span className="text-gray-200">{project.output_directory}</span></div>
                  <div>Branch: <span className="text-gray-200">{project.branch}</span></div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/60">
                <Link href={`/projects/${project.id}`} className="text-xs text-blue-400 hover:underline font-semibold">
                  Manage Project →
                </Link>
                <div className="flex items-center gap-2">
                  <a
                    href={`http://localhost:8080/serve/${project.id}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-card text-xs text-gray-300 font-medium rounded-lg border border-border flex items-center gap-1 hover:bg-gray-700 transition"
                  >
                    Visit Site <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={(e) => handleDeleteProject(e, project.id, project.name)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-red-500/20 transition"
                    title="Delete Project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
