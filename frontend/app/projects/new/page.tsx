'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderGit2, AlertCircle } from 'lucide-react';

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [installCommand, setInstallCommand] = useState('npm install');
  const [outputDirectory, setOutputDirectory] = useState('dist');
  const [branch, setBranch] = useState('main');
  const [repoUrl, setRepoUrl] = useState('https://github.com/demo/sample-static-site');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem('edgedeploy_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      // 1. Create Project
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          build_command: buildCommand,
          install_command: installCommand,
          output_directory: outputDirectory,
          branch,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create project');
      }

      const projectId = data.project.id;

      // 2. Link Repository if provided
      if (repoUrl) {
        await fetch(`/api/projects/${projectId}/repository`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ repoUrl }),
        });
      }

      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FolderGit2 className="w-6 h-6 text-blue-400" /> Create New Project
        </h1>
        <p className="text-sm text-gray-400 mt-1">Configure build settings and connect repository for automatic deployments</p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface border border-border p-6 rounded-2xl space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">Project Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm"
            placeholder="e.g. Portfolio Website"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">GitHub Repository URL</label>
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm font-mono"
            placeholder="https://github.com/owner/repository"
          />
          <span className="text-[11px] text-gray-400 mt-1 block">Supports public GitHub URLs or local fixture path for offline demos</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Install Command</label>
            <input
              type="text"
              value={installCommand}
              onChange={(e) => setInstallCommand(e.target.value)}
              className="w-full px-4 py-2 bg-card border border-border rounded-xl text-white text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Build Command</label>
            <input
              type="text"
              value={buildCommand}
              onChange={(e) => setBuildCommand(e.target.value)}
              className="w-full px-4 py-2 bg-card border border-border rounded-xl text-white text-sm font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Output Directory</label>
            <input
              type="text"
              value={outputDirectory}
              onChange={(e) => setOutputDirectory(e.target.value)}
              className="w-full px-4 py-2 bg-card border border-border rounded-xl text-white text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Target Branch</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full px-4 py-2 bg-card border border-border rounded-xl text-white text-sm font-mono"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-card hover:bg-gray-700 text-gray-300 font-medium text-sm rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-brand hover:bg-brandHover text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create & Link Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
