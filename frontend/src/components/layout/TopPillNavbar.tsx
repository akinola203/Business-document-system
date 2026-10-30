import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { usePermissions } from '../../hooks/usePermissions';
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
  Package,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ClientDemoModal } from '../demo/ClientDemoModal';

interface NavTab {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  category?: 'operations' | 'system';
}

// 1. Primary Nav Tabs (Visible Tabs)
const PRIMARY_TABS: NavTab[] = [
  { name: 'Overview', path: '/overview', icon: LayoutDashboard },
  { name: 'Invoices', path: '/documents/invoices', icon: FileText, permission: 'invoice:view' },
  { name: 'Waybills', path: '/documents/waybills', icon: Truck, permission: 'waybill:view' },
  { name: 'Letters', path: '/documents/letters', icon: Mail, permission: 'letter:view' },
  { name: 'Payments', path: '/payments', icon: CreditCard, permission: 'payment:view' },
];

// 2. Secondary / Management Tabs ("More ▼" Dropdown Menu)
const SECONDARY_TABS: NavTab[] = [
  { name: 'Clients', path: '/clients', icon: Users, permission: 'clients:view', category: 'operations' },
  { name: 'Vendors', path: '/vendors', icon: Building2, permission: 'vendors:view', category: 'operations' },
  { name: 'Supplies', path: '/supplies', icon: Package, permission: 'supplies:view', category: 'operations' },
  { name: 'Reports', path: '/reports', icon: BarChart3, permission: 'reports:view', category: 'system' },
  { name: 'Templates', path: '/settings/templates', icon: Palette, permission: 'settings:manage', category: 'system' },
  { name: 'Settings', path: '/settings/company', icon: Settings, permission: 'settings:manage', category: 'system' },
];

export const TopPillNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();
  const {
    user,
    hasPermission,
    canManageSettings,
    canViewAuditLogs,
    canManageUsers,
  } = usePermissions();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const moreDropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsProfileOpen(false);
    setIsMoreOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visiblePrimaryTabs = PRIMARY_TABS.filter((tab) => !tab.permission || hasPermission(tab.permission));
  const visibleSecondaryTabs = SECONDARY_TABS.filter((tab) => !tab.permission || hasPermission(tab.permission));

  const operationsTabs = visibleSecondaryTabs.filter((t) => t.category === 'operations');
  const systemTabs = visibleSecondaryTabs.filter((t) => t.category === 'system');

  const isMoreActive = visibleSecondaryTabs.some(
    (tab) => location.pathname === tab.path || location.pathname.startsWith(tab.path),
  );

  return (
    <header className="w-full flex flex-wrap items-center justify-between gap-3 py-1 px-1">
      {/* 1. Left: Brand Identity (Order 1 on all screens) */}
      <div className="flex items-center gap-3 order-1">
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-[#16181F] flex items-center justify-center text-white shadow-sm border border-slate-800 shrink-0">
          <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-[#5847F6]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xs md:text-sm font-bold tracking-tight text-slate-900">
              {user?.companyName || 'AOA 77 COMPANY LTD'}
            </h1>
            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 text-[#5847F6] border border-indigo-100">
              PRO
            </span>
          </div>
          <p className="text-[10px] md:text-[11px] text-slate-500 font-normal">Smart Documents, Better Business</p>
        </div>
      </div>

      {/* 2. Right: Utility Dock (Order 2 on mobile/tablet, Order 3 on xl+) */}
      <div className="flex items-center gap-1.5 md:gap-2 order-2 xl:order-3">
        {/* 1-Click Client Showcase Demo Mode */}
        <button
          onClick={() => setIsDemoModalOpen(true)}
          title="1-Click Client Showcase Demo Mode"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/10 to-indigo-500/10 hover:from-amber-500/20 hover:to-indigo-500/20 border border-amber-300/40 text-amber-900 text-xs font-semibold transition-all shadow-xs"
        >
          <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
          <span className="hidden sm:inline">Demo Mode</span>
        </button>

        {/* Audit Log Trail (Admin / Privileged only) */}
        {canViewAuditLogs && (
          <button
            onClick={() => navigate('/audit-logs')}
            title="Audit Trail Logs"
            className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Users & Roles (Admin / User Manager only) */}
        {canManageUsers && (
          <button
            onClick={() => navigate('/settings/users')}
            title="Team & Access Control"
            className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all shadow-xs"
          >
            <Users className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Notifications Dock with Unread Badge */}
        <button
          onClick={() => navigate('/notifications')}
          title="Notifications"
          className="relative w-8 h-8 md:w-9 md:h-9 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all shadow-xs"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
          )}
        </button>

        {/* User Profile Dropdown Pill */}
        <div className="relative ml-0.5" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 shadow-xs transition-all"
          >
            <div className="w-6 h-6 rounded-full bg-[#5847F6] text-white flex items-center justify-center font-bold text-[11px] uppercase shadow-xs">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-900 leading-tight">
                {user?.fullName || 'User'}
              </div>
              <div className="text-[10px] text-slate-500 font-normal">
                {user?.roleName || user?.role || 'Staff'}
              </div>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-2xl border border-slate-200/90 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900">{user?.fullName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                  <Building2 className="w-3 h-3" />
                  {user?.companyName}
                </div>
              </div>

              <div className="py-1">
                {canManageSettings && (
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
                )}
                {canViewAuditLogs && (
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
                )}
                {canManageUsers && (
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate('/settings/users');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    Team & Access Control
                  </button>
                )}
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

      {/* 3. Center: Compact Enterprise Obsidian Navigation Pill (Order 3 on mobile/tablet, Order 2 on xl+) */}
      <div className="w-full xl:w-auto flex items-center justify-center order-3 xl:order-2">
        <nav className="inline-flex items-center gap-1 bg-[#16181F] text-slate-300 rounded-full p-1 shadow-lg shadow-slate-950/15 border border-slate-800/90">
          {/* Primary Nav Tabs */}
          {visiblePrimaryTabs.map((tab) => {
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
                    'flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-1.5 rounded-full text-xs md:text-[13px] font-medium transition-all duration-150 whitespace-nowrap',
                    linkActive || isActive
                      ? 'bg-[#5847F6] text-white shadow-sm shadow-indigo-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5',
                  )
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.name}</span>
              </NavLink>
            );
          })}

          {/* Secondary / Management Dropdown Menu ("More ▼") */}
          {visibleSecondaryTabs.length > 0 && (
            <div className="relative" ref={moreDropdownRef}>
              <button
                type="button"
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-1.5 rounded-full text-xs md:text-[13px] font-medium transition-all duration-150 whitespace-nowrap',
                  isMoreActive
                    ? 'bg-[#5847F6] text-white shadow-sm shadow-indigo-500/30'
                    : isMoreOpen
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5',
                )}
              >
                <span>More</span>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 transition-transform duration-200',
                    isMoreOpen && 'rotate-180',
                  )}
                />
              </button>

              {/* Dropdown Menu */}
              {isMoreOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 xl:left-auto xl:right-0 xl:translate-x-0 mt-2 w-56 rounded-2xl bg-white shadow-2xl border border-slate-200/90 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {operationsTabs.length > 0 && (
                    <div>
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Operations & CRM
                      </div>
                      {operationsTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive =
                          location.pathname === tab.path || location.pathname.startsWith(tab.path);
                        return (
                          <NavLink
                            key={tab.path}
                            to={tab.path}
                            onClick={() => setIsMoreOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                              isActive
                                ? 'bg-indigo-50 text-[#5847F6] font-semibold'
                                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                            )}
                          >
                            <Icon className={cn('w-4 h-4', isActive ? 'text-[#5847F6]' : 'text-slate-400')} />
                            <span>{tab.name}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}

                  {operationsTabs.length > 0 && systemTabs.length > 0 && (
                    <div className="my-1 border-t border-slate-100" />
                  )}

                  {systemTabs.length > 0 && (
                    <div>
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Analytics & System
                      </div>
                      {systemTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive =
                          location.pathname === tab.path || location.pathname.startsWith(tab.path);
                        return (
                          <NavLink
                            key={tab.path}
                            to={tab.path}
                            onClick={() => setIsMoreOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                              isActive
                                ? 'bg-indigo-50 text-[#5847F6] font-semibold'
                                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                            )}
                          >
                            <Icon className={cn('w-4 h-4', isActive ? 'text-[#5847F6]' : 'text-slate-400')} />
                            <span>{tab.name}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* 1-Click Client Showcase Demo Modal */}
      <ClientDemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} />
    </header>
  );
};
