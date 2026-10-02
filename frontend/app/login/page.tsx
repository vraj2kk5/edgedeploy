'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const tabToken = sessionStorage.getItem('edgedeploy_token');
    if (tabToken) {
      router.push('/dashboard');
    }
  }, [router]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [resetLink, setResetLink] = useState('');

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg('');
    setResetLink('');
    setForgotLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to process forgot password request');
      }
      setForgotMsg(data.message);
      if (data.resetLink) {
        setResetLink(data.resetLink);
      }
    } catch (err: any) {
      setForgotMsg(err.message || 'An error occurred');
    } finally {
      setForgotLoading(false);
    }
  };

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

      let data: any = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server returned status ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      sessionStorage.setItem('edgedeploy_token', data.token);
      sessionStorage.setItem('edgedeploy_user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-300">Password</label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs text-blue-400 hover:underline"
              >
                Forgot password?
              </button>
            </div>
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

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-2">Reset Password</h2>
            <p className="text-xs text-gray-400 mb-4">
              Enter your account email address and we will generate a password reset link for you.
            </p>

            {forgotMsg && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300 text-xs space-y-2">
                <div>{forgotMsg}</div>
                {resetLink && (
                  <div className="pt-2 border-t border-blue-500/20">
                    <span className="font-semibold text-white">Reset Link: </span>
                    <a
                      href={resetLink}
                      className="text-cyan-400 underline break-all font-mono"
                    >
                      {resetLink}
                    </a>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm transition"
                  placeholder="yourname@example.com"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotMsg('');
                    setResetLink('');
                  }}
                  className="px-4 py-2 bg-card hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-semibold border border-border transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="px-4 py-2 bg-brand hover:bg-brandHover text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  {forgotLoading ? 'Processing...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
