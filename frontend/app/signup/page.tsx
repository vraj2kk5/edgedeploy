'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, AlertCircle } from 'lucide-react';

export default function SignupPage() {
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
      const res = await fetch('/api/auth/signup', {
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
        throw new Error(data.error?.message || 'Signup failed');
      }

      localStorage.setItem('edgedeploy_token', data.token);
      localStorage.setItem('edgedeploy_user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-bold text-white mb-3 shadow-lg shadow-blue-500/20">
            <Zap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Developer Account</h1>
          <p className="text-sm text-gray-400 mt-1">Start deploying static apps to EdgeDeploy CDN</p>
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
            
            {/* Live Password Requirements Indicator */}
            <div className="mt-3 p-3 bg-card/60 border border-border/80 rounded-xl space-y-1.5 text-xs">
              <div className="font-semibold text-gray-300 text-[11px] uppercase tracking-wider mb-1">Password Requirements:</div>
              <div className={`flex items-center gap-1.5 ${password.length >= 8 ? 'text-emerald-400 font-medium' : 'text-gray-400'}`}>
                <span>{password.length >= 8 ? '✓' : '○'}</span> At least 8 characters
              </div>
              <div className={`flex items-center gap-1.5 ${/[A-Z]/.test(password) ? 'text-emerald-400 font-medium' : 'text-gray-400'}`}>
                <span>{/[A-Z]/.test(password) ? '✓' : '○'}</span> One uppercase letter (A-Z)
              </div>
              <div className={`flex items-center gap-1.5 ${/[a-z]/.test(password) ? 'text-emerald-400 font-medium' : 'text-gray-400'}`}>
                <span>{/[a-z]/.test(password) ? '✓' : '○'}</span> One lowercase letter (a-z)
              </div>
              <div className={`flex items-center gap-1.5 ${/[0-9]/.test(password) ? 'text-emerald-400 font-medium' : 'text-gray-400'}`}>
                <span>{/[0-9]/.test(password) ? '✓' : '○'}</span> One number (0-9)
              </div>
              <div className={`flex items-center gap-1.5 ${/[^A-Za-z0-9]/.test(password) ? 'text-emerald-400 font-medium' : 'text-gray-400'}`}>
                <span>{/[^A-Za-z0-9]/.test(password) ? '✓' : '○'}</span> One special character (!@#$%...)
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand hover:bg-brandHover text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
