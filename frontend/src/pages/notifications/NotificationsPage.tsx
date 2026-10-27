import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Truck,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  FileText,
  Mail,
  Building2,
  User,
  Filter,
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { DEMO_NOTIFICATIONS } from '../../lib/mock-data';
import { NotificationItem } from '../../types';

type NotificationFilter = 'ALL' | 'UNREAD' | 'APPROVALS' | 'LOGISTICS' | 'PAYMENTS';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch notifications from live API, falling back cleanly to DEMO_NOTIFICATIONS
  const { data: notifData } = useQuery<{ items: NotificationItem[]; unreadCount: number }>({
    queryKey: ['notifications-list'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/notifications', { params: { limit: 50 } });
        const items = res.data?.items ?? res.data?.data?.items ?? DEMO_NOTIFICATIONS;
        const unreadCount = res.data?.unreadCount ?? res.data?.data?.unreadCount ?? items.filter((n: any) => !n.isRead).length;
        return { items, unreadCount };
      } catch (err: any) {
        if (!err.response) {
          return {
            items: DEMO_NOTIFICATIONS,
            unreadCount: DEMO_NOTIFICATIONS.filter((n) => !n.isRead).length,
          };
        }
        throw err;
      }
    },
    initialData: {
      items: DEMO_NOTIFICATIONS,
      unreadCount: DEMO_NOTIFICATIONS.filter((n) => !n.isRead).length,
    },
  });

  const notifications = notifData?.items || DEMO_NOTIFICATIONS;
  const unreadCount = notifData?.unreadCount ?? notifications.filter((n) => !n.isRead).length;

  // Mutation: Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiClient.patch(`/notifications/${id}/read`);
      } catch (err: any) {
        // Fallback optimistically on network error
        if (err.response) throw err;
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData(['notifications-list'], (old: any) => {
        if (!old) return old;
        const updated = old.items.map((n: NotificationItem) =>
          n.id === id ? { ...n, isRead: true } : n,
        );
        return {
          items: updated,
          unreadCount: Math.max(0, updated.filter((n: NotificationItem) => !n.isRead).length),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  // Mutation: Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      try {
        await apiClient.patch('/notifications/read-all');
      } catch (err: any) {
        if (err.response) throw err;
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(['notifications-list'], (old: any) => {
        if (!old) return old;
        return {
          items: old.items.map((n: NotificationItem) => ({ ...n, isRead: true })),
          unreadCount: 0,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  // Filtered notification list
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === 'UNREAD') return !n.isRead;
      if (activeFilter === 'APPROVALS') return n.type === 'APPROVAL_REQUEST';
      if (activeFilter === 'LOGISTICS') return n.type.startsWith('WAYBILL_');
      if (activeFilter === 'PAYMENTS') return n.type.includes('PAYMENT') || n.type.includes('INVOICE_PAID');
      return true;
    });
  }, [notifications, activeFilter]);

  // Selected item defaults to first item in filtered list
  const selectedItem = useMemo(() => {
    if (selectedId) {
      const found = notifications.find((n) => n.id === selectedId);
      if (found) return found;
    }
    return filteredNotifications[0] || null;
  }, [notifications, selectedId, filteredNotifications]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'APPROVAL_REQUEST':
        return <Clock className="w-5 h-5 text-amber-400" />;
      case 'INVOICE_PAID':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'WAYBILL_DISPATCHED':
        return <Truck className="w-5 h-5 text-indigo-400" />;
      case 'WAYBILL_FAILED':
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      case 'DOCUMENT_APPROVED':
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case 'DOCUMENT_REJECTED':
        return <AlertCircle className="w-5 h-5 text-rose-400" />;
      case 'PAYMENT_REVERSED':
        return <RefreshCw className="w-5 h-5 text-orange-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-300" />;
    }
  };

  const getCategoryBadge = (type: string) => {
    switch (type) {
      case 'APPROVAL_REQUEST':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">Approval Required</span>;
      case 'INVOICE_PAID':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">Settled Payment</span>;
      case 'WAYBILL_DISPATCHED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300">Transit Dispatch</span>;
      case 'WAYBILL_FAILED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">Delivery Exception</span>;
      case 'DOCUMENT_APPROVED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">Sign-Off Granted</span>;
      case 'DOCUMENT_REJECTED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">Returned for Revision</span>;
      case 'PAYMENT_REVERSED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300">Reversal Audit</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">System Notification</span>;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handleOpenDocument = (item: NotificationItem) => {
    if (!item.isRead) {
      markAsReadMutation.mutate(item.id);
    }
    const targetRoute = item.metadata?.route || (
      item.type.includes('WAYBILL')
        ? '/documents/waybills'
        : item.type.includes('INVOICE')
        ? '/documents/invoices'
        : item.type.includes('LETTER')
        ? '/documents/letters'
        : '/overview'
    );
    navigate(targetRoute);
  };

  return (
    <div className="w-full space-y-6">
      {/* TIER 1: HEADER & ACTIONS DOCK */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Notifications Center</h1>
            {unreadCount > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#5847F6] text-white shadow-sm tabular-nums">
                {unreadCount} Unread
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                All Caught Up
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-500">
            Lifecycle status transitions, executive approvals, logistics exceptions, and payment settlements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={unreadCount === 0 || markAllAsReadMutation.isPending}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${
              unreadCount > 0
                ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mark All as Read</span>
          </button>
        </div>
      </div>

      {/* TIER 2: FILTER PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
        {(
          [
            { key: 'ALL', label: 'All Alerts', count: notifications.length },
            { key: 'UNREAD', label: 'Unread Only', count: unreadCount },
            {
              key: 'APPROVALS',
              label: 'Approvals Required',
              count: notifications.filter((n) => n.type === 'APPROVAL_REQUEST').length,
            },
            {
              key: 'LOGISTICS',
              label: 'Logistics Alerts',
              count: notifications.filter((n) => n.type.startsWith('WAYBILL_')).length,
            },
            {
              key: 'PAYMENTS',
              label: 'Payments & Settlements',
              count: notifications.filter((n) => n.type.includes('PAYMENT') || n.type.includes('INVOICE_PAID')).length,
            },
          ] as Array<{ key: NotificationFilter; label: string; count: number }>
        ).map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <span>{filter.label}</span>
              {filter.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {filter.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TIER 3: DARK OBSIDIAN MASTER-DETAIL NOTIFICATION STREAM */}
      <div className="bg-[#16181F] rounded-[32px] p-6 md:p-8 text-white shadow-xl border border-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[520px]">
          {/* Left Pane (5 Columns / 42%): Selectable Feed */}
          <div className="lg:col-span-5 space-y-3 overflow-y-auto max-h-[640px] pr-2">
            {filteredNotifications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-2">
                <Bell className="w-10 h-10 text-slate-600 mb-2" />
                <div className="font-bold text-sm text-slate-300">No Notifications</div>
                <p className="text-xs text-slate-500">There are no notifications matching your current filter.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const isSelected = selectedItem?.id === notif.id;
                return (
                  <div
                    key={notif.id}
                    onClick={() => setSelectedId(notif.id)}
                    className={`p-4 rounded-2xl transition-all cursor-pointer border relative group ${
                      isSelected
                        ? 'bg-white/10 border-white/30 shadow-lg'
                        : 'bg-white/5 border-white/5 hover:bg-white/[0.08] hover:border-white/10'
                    }`}
                  >
                    {/* Unread Electric Indigo Dot */}
                    {!notif.isRead && (
                      <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-[#5847F6] ring-2 ring-[#16181F]" />
                    )}

                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-white/10 shrink-0 mt-0.5">
                        {getNotificationIcon(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          {getCategoryBadge(notif.type)}
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-white transition-colors">
                          {notif.title}
                        </h4>

                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Pane (7 Columns / 58%): Royal Indigo Action Inspector */}
          <div className="lg:col-span-7 bg-[#5B58B6] rounded-[24px] p-6 md:p-8 text-white shadow-xl border border-white/10 flex flex-col justify-between">
            {selectedItem ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    {getCategoryBadge(selectedItem.type)}
                    <span className="text-xs text-white/70 font-semibold tabular-nums">
                      {new Date(selectedItem.createdAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white tracking-tight leading-snug">
                    {selectedItem.title}
                  </h3>

                  <p className="text-sm text-white/90 leading-relaxed mt-3">
                    {selectedItem.message}
                  </p>
                </div>

                {/* Linked Entity Preview Card */}
                {selectedItem.metadata && (
                  <div className="bg-white/10 border border-white/15 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-extrabold text-white/60 tracking-wider">
                        Linked Business Object
                      </span>
                      {selectedItem.metadata.documentNumber && (
                        <span className="px-2.5 py-1 rounded-full bg-white text-slate-950 text-xs font-black tabular-nums shadow-sm">
                          {selectedItem.metadata.documentNumber}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      {selectedItem.metadata.clientName && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-white/60 font-medium">Client / Counterparty</span>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                            <Building2 className="w-3.5 h-3.5 text-white/80" />
                            <span>{selectedItem.metadata.clientName}</span>
                          </div>
                        </div>
                      )}

                      {selectedItem.metadata.amount && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-white/60 font-medium">Financial Value</span>
                          <div className="text-xs font-black text-white tabular-nums">
                            ₦{Number(selectedItem.metadata.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      )}

                      {selectedItem.metadata.actorName && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-white/60 font-medium">Triggered By</span>
                          <div className="text-xs font-semibold text-white/90 flex items-center gap-1.5 truncate">
                            <User className="w-3.5 h-3.5 text-white/80" />
                            <span>{selectedItem.metadata.actorName}</span>
                          </div>
                        </div>
                      )}

                      {selectedItem.metadata.documentType && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-white/60 font-medium">Document Class</span>
                          <div className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-white/80" />
                            <span>{selectedItem.metadata.documentType}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Primary Action Buttons */}
                <div className="pt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleOpenDocument(selectedItem)}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-slate-950 hover:bg-slate-100 text-xs font-black transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>
                      {selectedItem.type === 'APPROVAL_REQUEST' ? 'Review & Sign Off Now' : 'Open in Workspace'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#5847F6]" />
                  </button>

                  {!selectedItem.isRead && (
                    <button
                      onClick={() => markAsReadMutation.mutate(selectedItem.id)}
                      disabled={markAsReadMutation.isPending}
                      className="px-4 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20"
                    >
                      <span>Mark as Read</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <Bell className="w-12 h-12 text-white/40" />
                <h4 className="text-base font-bold text-white">Select a Notification</h4>
                <p className="text-xs text-white/70 max-w-sm">
                  Click any alert from the left stream to inspect transaction metadata and take action.
                </p>
              </div>
            )}

            <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between text-[11px] text-white/70">
              <span>Security Event Stream</span>
              <span>AOA 77 Real-time Notification Engine</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
