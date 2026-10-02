'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, AlertCircle } from 'lucide-react';

export default function SignupPage() {
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
  const [isFocused, setIsFocused] = useState(false);

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

      sessionStorage.setItem('edgedeploy_token', data.token);
      sessionStorage.setItem('edgedeploy_user', JSON.stringify(data.user));
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
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm transition"
              placeholder="••••••••"
            />
            
            {/* Sleek single-line requirement hint on focus/typing */}
            {(isFocused || password.length > 0) && (
              <div className="mt-1.5 text-[11px] transition-all duration-200">
                {(() => {
                  const missing = [];
                  if (password.length < 8) missing.push('8+ chars');
                  if (!/[A-Z]/.test(password)) missing.push('uppercase A-Z');
                  if (!/[a-z]/.test(password)) missing.push('lowercase a-z');
                  if (!/[0-9]/.test(password)) missing.push('number 0-9');
                  if (!/[^A-Za-z0-9]/.test(password)) missing.push('special char (!@#$)');

                  if (missing.length === 0) {
                    return (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        ✓ Strong password - meets all requirements
                      </span>
                    );
                  }
                  return (
                    <span className="text-gray-400">
                      <span className="text-amber-400 font-medium">Required:</span> {missing.join(', ')}
                    </span>
                  );
                })()}
              </div>
            )}
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
