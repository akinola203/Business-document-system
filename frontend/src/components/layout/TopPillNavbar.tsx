import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { usePermissions } from '../../hooks/usePermissions';
import { useTheme } from '../../context/ThemeContext';
import { apiClient } from '../../lib/api-client';
import {
  FileText,
  Truck,
  Mail,
  CreditCard,
  Users,
  BarChart3,
  LayoutDashboard,
  ShieldCheck,
  Bell,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  Sparkles,
  UserCog,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavTab {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

// Flattened single-click navigation bar (zero nested dropdowns or hidden tabs)
const MAIN_NAV_TABS: NavTab[] = [
  { name: 'Dashboard', path: '/overview', icon: LayoutDashboard },
  { name: 'Invoices', path: '/documents/invoices', icon: FileText, permission: 'invoice:view' },
  { name: 'Waybills & Dispatch', path: '/documents/waybills', icon: Truck, permission: 'waybill:view' },
  { name: 'Payments & Receipts', path: '/payments', icon: CreditCard, permission: 'payment:view' },
  { name: 'Letters', path: '/documents/letters', icon: Mail, permission: 'letter:view' },
  { name: 'Clients / Customers', path: '/clients', icon: Users, permission: 'clients:view' },
  { name: 'Reports', path: '/reports', icon: BarChart3, permission: 'reports:view' },
  { name: 'Settings', path: '/settings/company', icon: Settings, permission: 'settings:manage' },
];

export const TopPillNavbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const {
    user,
    hasPermission,
    canManageSettings,
    canViewAuditLogs,
    canManageUsers,
  } = usePermissions();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Live Unread Notifications Count Query
  const { data: countData } = useQuery<{ unreadCount: number }>({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/notifications', { params: { limit: 1 } });
        const unread = res.data?.unreadCount ?? res.data?.data?.unreadCount ?? 0;
        return { unreadCount: unread };
      } catch {
        return { unreadCount: 0 };
      }
    },
    refetchInterval: 15000,
    initialData: { unreadCount: 0 },
  });

  const unreadCount = countData?.unreadCount ?? 0;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsProfileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleTabs = MAIN_NAV_TABS.filter(
    (tab) => !tab.permission || hasPermission(tab.permission),
  );

  const displayFullName =
    user?.fullName && user.fullName.trim().length > 0
      ? user.fullName
      : 'Akindeji Akinlade';

  // Fetch company branding logo if uploaded in Settings -> Branding Assets
  const { data: companyData } = useQuery<any>({
    queryKey: ['company-current'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/companies/current');
        return res.data;
      } catch {
        return null;
      }
    },
  });
  const companyObj = companyData?.data || companyData;
  const customLogoUrl =
    companyObj?.settings?.logoUrl ||
    companyObj?.settings?.metadata?.logoUrl ||
    (typeof window !== 'undefined' ? localStorage.getItem('aoa_branding_logo_url') : null) ||
    '/aoa77-logo.svg';

  return (
    <header className="w-full flex flex-wrap items-center justify-between gap-3 py-2 px-3 rounded-3xl bg-white/80 dark:bg-[#11131A]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-sm">
      {/* 1. Left: AOA 77 Supports Circular Badge Logo & Identity */}
      <Link
        to="/overview"
        title="Go to Dashboard"
        className="flex items-center gap-3 order-1 cursor-pointer hover:opacity-90 transition-opacity"
      >
        {customLogoUrl ? (
          <img
            src={customLogoUrl}
            alt="AOA 77 Supports Logo"
            className="w-11 h-11 rounded-full object-contain bg-white border-2 border-slate-900 dark:border-white/20 shadow-md shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-[#0F1117] text-white flex flex-col items-center justify-center shadow-md border-2 border-slate-700/80 shrink-0 select-none">
            <span className="text-[10px] font-black tracking-tighter leading-none">AOA</span>
            <span className="text-[9px] font-extrabold text-slate-300 leading-none mt-0.5">77</span>
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm md:text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
              AOA 77 Supports
            </h1>
            <span className="text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full bg-slate-900 text-white dark:bg-white/15 dark:text-white">
              MD
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {user?.companyName || 'AOA 77 COMPANY LTD'}
          </p>
        </div>
      </Link>

      {/* 2. Right: Utility & Profile Controls */}
      <div className="flex items-center gap-2 order-2 xl:order-3">
        {/* Light / Dark Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-9 h-9 rounded-full bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all shadow-xs cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          title="Notifications"
          className="relative w-9 h-9 rounded-full bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all shadow-xs cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
          )}
        </button>

        {/* User Profile Pill */}
        <div className="relative ml-0.5" ref={dropdownRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200 shadow-xs transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-[#5847F6] text-white flex items-center justify-center font-extrabold text-xs uppercase shadow-xs">
              {displayFullName.charAt(0)}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-extrabold text-slate-900 leading-tight">
                {displayFullName}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {user?.roleName || user?.role || 'Super Admin / Managing Director'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {/* Profile Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-2xl border border-slate-200 p-2 z-50">
              <div
                onClick={() => {
                  setIsProfileOpen(false);
                  navigate('/settings/users?edit=me');
                }}
                className="p-3 border-b border-slate-100 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
              >
                <p className="text-sm font-bold text-slate-900">{displayFullName}</p>
                <p className="text-xs text-slate-500 truncate">
                  {user?.email || 'dejakinlade@gmail.com'}
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold">
                  <Building2 className="w-3 h-3" />
                  {user?.companyName || 'AOA 77 COMPANY LTD'}
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setIsProfileOpen(false);
                    navigate('/settings/users?edit=me');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#5847F6] hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                >
                  <UserCog className="w-4 h-4 text-[#5847F6]" />
                  Edit My Profile & Password
                </button>
                {canManageSettings && (
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate('/settings/company');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    Company Settings
                  </button>
                )}
                {canManageUsers && (
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate('/settings/users');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-slate-400" />
                    Team & Access Control
                  </button>
                )}
                {canViewAuditLogs && (
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate('/audit-logs');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                    Activity & Security History
                  </button>
                )}
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Center: Flattened Single-Click Navigation Bar */}
      <div className="w-full xl:w-auto flex items-center justify-center order-3 xl:order-2">
        <nav className="inline-flex items-center gap-1 bg-[#16181F] text-slate-200 rounded-2xl p-1.5 shadow-lg border border-slate-800 flex-wrap justify-center">
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
                    'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all duration-150 whitespace-nowrap',
                    linkActive || isActive
                      ? 'bg-[#5847F6] text-white shadow-sm shadow-indigo-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-white/10',
                  )
                }
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
