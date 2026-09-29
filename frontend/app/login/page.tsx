'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      localStorage.setItem('edgedeploy_token', data.token);
      localStorage.setItem('edgedeploy_user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoDev = () => {
    setEmail('dev@edgedeploy.local');
    setPassword('DevPassword123!');
  };

  const handleDemoAdmin = () => {
    setEmail('admin@edgedeploy.local');
    setPassword('AdminPassword123!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-bold text-white mb-3 shadow-lg shadow-blue-500/20">
            <Zap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to EdgeDeploy</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to your CDN deployment dashboard</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm transition"
              placeholder="developer@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand hover:bg-brandHover text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 border-t border-border/60 pt-4 text-center">
          <div className="text-xs text-gray-400 mb-2">Demo Quick Logins:</div>
          <div className="flex gap-2">
            <button
              onClick={handleDemoDev}
              className="flex-1 py-1.5 px-3 bg-card hover:bg-gray-700 text-xs text-blue-400 border border-border rounded-lg transition"
            >
              Developer Demo
            </button>
            <button
              onClick={handleDemoAdmin}
              className="flex-1 py-1.5 px-3 bg-card hover:bg-gray-700 text-xs text-amber-400 border border-border rounded-lg transition"
            >
              Admin Demo
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-blue-400 hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
