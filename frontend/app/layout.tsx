'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import './globals.css';
import {
  Globe,
  LayoutDashboard,
  FolderGit2,
  Activity,
  ShieldAlert,
  Server,
  LogOut,
  UserCheck,
  Zap,
  Sun,
  Moon,
} from 'lucide-react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAuthPage, setIsAuthPage] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const getThemeKey = (u?: any) => (u?.id ? `edgedeploy_theme_user_${u.id}` : 'edgedeploy_theme');

  useEffect(() => {
    setIsAuthPage(pathname === '/login' || pathname === '/signup');
    const storedUser = localStorage.getItem('edgedeploy_user');
    let currentUser: any = null;
    if (storedUser) {
      try {
        currentUser = JSON.parse(storedUser);
        setUser(currentUser);
      } catch (e) {}
    }

    const key = getThemeKey(currentUser);
    const savedTheme = (localStorage.getItem(key) || localStorage.getItem('edgedeploy_theme') || 'dark') as 'dark' | 'light';
    setTheme(savedTheme);
    applyThemeClass(savedTheme);
  }, [pathname]);

  const applyThemeClass = (targetTheme: 'dark' | 'light') => {
    const root = document.documentElement;
    if (targetTheme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyThemeClass(nextTheme);
    const key = getThemeKey(user);
    localStorage.setItem(key, nextTheme);
    localStorage.setItem('edgedeploy_theme', nextTheme);
  };

  const handleLogout = () => {
    localStorage.removeItem('edgedeploy_token');
    localStorage.removeItem('edgedeploy_user');
    setUser(null);
    router.push('/login');
  };

  if (isAuthPage) {
    return (
      <html lang="en" className={theme}>
        <body className="bg-background text-gray-100 antialiased min-h-screen">
          {children}
        </body>
      </html>
    );
  }

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Projects', href: '/projects', icon: FolderGit2 },
  ];

  const adminItems = [
    { name: 'Admin Overview', href: '/admin', icon: ShieldAlert },
    { name: 'Edge Nodes', href: '/admin/edges', icon: Server },
    { name: 'Users', href: '/admin/users', icon: UserCheck },
    { name: 'Rate Limits', href: '/admin/rate-limits', icon: Activity },
  ];

  return (
    <html lang="en" className={theme}>
      <body className="bg-background text-gray-100 antialiased min-h-screen flex flex-col">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-50 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <Link href="/dashboard" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              EdgeDeploy <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">CDN Platform</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* User Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-xl border border-border bg-card/60 text-gray-300 hover:text-white hover:bg-card transition flex items-center gap-2 text-xs font-medium"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-blue-500" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right text-xs">
                  <div className="font-semibold text-gray-200">{user.email}</div>
                  <div className="text-gray-400 uppercase tracking-wider font-mono text-[10px]">{user.role}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm bg-brand hover:bg-brandHover text-white font-medium rounded-lg transition"
              >
                Log In
              </Link>
            )}
          </div>
        </header>

        <div className="flex-1 flex">
          {/* Sidebar */}
          <aside className="w-64 border-r border-border bg-surface p-4 flex flex-col justify-between shrink-0">
            <div className="space-y-6">
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Developer Platform</div>
                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                          isActive
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-card'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {user?.role === 'ADMIN' && (
                <div>
                  <div className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider px-3 mb-2 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" /> Admin Panel
                  </div>
                  <nav className="space-y-1">
                    {adminItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                            isActive
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-card'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              )}
            </div>

            {/* Quick Info Badge */}
            <div className="p-3 bg-card/60 rounded-xl border border-border/60 text-xs text-gray-400 space-y-1">
              <div className="flex items-center justify-between text-gray-300 font-medium">
                <span>Gateway Entry</span>
                <span className="text-green-400 font-mono">:8080</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Origin Server</span>
                <span className="font-mono">:4000</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Edge Nodes</span>
                <span className="font-mono">:4101-4103</span>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 p-8 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
