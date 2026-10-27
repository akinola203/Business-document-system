import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { apiClient } from '../../lib/api-client';
import { DEMO_NOTIFICATIONS } from '../../lib/mock-data';
import {
  FileText,
  Truck,
  Mail,
  CreditCard,
  Users,
  BarChart3,
  LayoutDashboard,
  Palette,
  ShieldCheck,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavTab {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

const NAV_TABS: NavTab[] = [
  { name: 'Overview', path: '/overview', icon: LayoutDashboard },
  { name: 'Invoices', path: '/documents/invoices', icon: FileText, permission: 'invoice:view' },
  { name: 'Waybills', path: '/documents/waybills', icon: Truck, permission: 'waybill:view' },
  { name: 'Letters', path: '/documents/letters', icon: Mail, permission: 'letter:view' },
  { name: 'Payments', path: '/payments', icon: CreditCard, permission: 'payment:view' },
  { name: 'Clients', path: '/clients', icon: Users, permission: 'clients:view' },
  { name: 'Reports', path: '/reports', icon: BarChart3, permission: 'reports:view' },
];

export const TopPillNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuthStore();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Live Unread Notifications Count Query
  const { data: countData } = useQuery<{ unreadCount: number }>({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/notifications', { params: { limit: 1 } });
        const unread = res.data?.unreadCount ?? res.data?.data?.unreadCount ?? DEMO_NOTIFICATIONS.filter((n) => !n.isRead).length;
        return { unreadCount: unread };
      } catch {
        return { unreadCount: DEMO_NOTIFICATIONS.filter((n) => !n.isRead).length };
      }
    },
    refetchInterval: 15000,
    initialData: { unreadCount: DEMO_NOTIFICATIONS.filter((n) => !n.isRead).length },
  });

  const unreadCount = countData?.unreadCount ?? 0;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleTabs = NAV_TABS.filter((tab) => !tab.permission || hasPermission(tab.permission));

  return (
    <header className="w-full flex flex-col lg:flex-row items-center justify-between gap-4 py-2 px-1">
      {/* 1. Left: Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[#16181F] flex items-center justify-center text-white shadow-md shadow-slate-900/10 border border-slate-800">
          <Sparkles className="w-6 h-6 text-[#5847F6]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-tight text-slate-900">
              {user?.companyName || 'AOA 77 COMPANY LTD'}
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-[#5847F6] border border-indigo-100">
              PRO
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">Smart Documents, Better Business</p>
        </div>
      </div>

      {/* 2. Center: Signature Floating Obsidian Pill */}
      <nav className="bg-[#16181F] text-slate-300 rounded-full p-1.5 flex items-center gap-1 shadow-xl shadow-slate-950/20 border border-slate-800/80 overflow-x-auto max-w-full">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            location.pathname === tab.path ||
            (tab.path !== '/overview' && location.pathname.startsWith(tab.path));

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive: linkActive }) =>
                cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  linkActive || isActive
                    ? 'bg-[#5847F6] text-white shadow-md shadow-indigo-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5',
                )
              }
            >
              <Icon className="w-4 h-4" />
              <span>{tab.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* 3. Right: Circular Utility Dock */}
      <div className="flex items-center gap-2">
        {/* Templates Designer Shortcut */}
        <button
          onClick={() => navigate('/settings/templates')}
          title="Document Templates"
          className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all shadow-sm hover:shadow"
        >
          <Palette className="w-4 h-4" />
        </button>

        {/* Audit Log Trail */}
        <button
          onClick={() => navigate('/audit-logs')}
          title="Audit Trail Logs"
          className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all shadow-sm hover:shadow"
        >
          <ShieldCheck className="w-4 h-4" />
        </button>

        {/* Users & Roles (Guarded) */}
        {hasPermission('users:view') && (
          <button
            onClick={() => navigate('/settings/users')}
            title="Team & Access Control"
            className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all shadow-sm hover:shadow"
          >
            <Users className="w-4 h-4" />
          </button>
        )}

        {/* Notifications Dock with Unread Badge */}
        <button
          onClick={() => navigate('/notifications')}
          title="Notifications"
          className="relative w-10 h-10 rounded-full bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all shadow-sm hover:shadow"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
          )}
        </button>

        {/* Company Settings */}
        <button
          onClick={() => navigate('/settings/company')}
          title="Company Branding & Settings"
          className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all shadow-sm hover:shadow"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Profile Dropdown Pill */}
        <div className="relative ml-1" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-[#5847F6] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {user?.fullName || 'User'}
              </div>
              <div className="text-[10px] text-slate-500 font-medium">
                {user?.roleName || user?.role || 'Staff'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-2xl border border-slate-200/80 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900">{user?.fullName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                  <Building2 className="w-3 h-3" />
                  {user?.companyName}
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/settings/company');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  Company Settings
                </button>
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/audit-logs');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  Security & Audit Logs
                </button>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
