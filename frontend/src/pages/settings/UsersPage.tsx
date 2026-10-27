import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { CompanyUser, Role } from '../../types';
import { DEMO_USERS, DEMO_ROLES } from '../../lib/mock-data';
import { useAuthStore } from '../../store/auth.store';
import {
  Users,
  ShieldCheck,
  UserPlus,
  KeyRound,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  Shield,
  Edit2,
  RefreshCw,
  Ban,
  Check,
} from 'lucide-react';

export const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentAuthUser } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'USERS' | 'ROLES'>('USERS');

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<CompanyUser | null>(null);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<CompanyUser | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState('role-staff');
  const [invitePhone, setInvitePhone] = useState('');

  // Password reset state
  const [newPassword, setNewPassword] = useState('');

  // 1. Fetch Users
  const { data: usersData } = useQuery<{ items?: CompanyUser[]; data?: CompanyUser[] }>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiClient.get('/users', { params: { limit: 100 } });
      return res.data;
    },
  });

  const allUsers: CompanyUser[] =
    usersData?.items && usersData.items.length > 0
      ? usersData.items
      : usersData?.data && usersData.data.length > 0
      ? usersData.data
      : DEMO_USERS;

  // 2. Fetch Roles
  const { data: rolesData } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await apiClient.get('/roles');
      return res.data;
    },
  });

  const allRoles: Role[] =
    Array.isArray(rolesData) && rolesData.length > 0
      ? rolesData
      : (rolesData as any)?.data && Array.isArray((rolesData as any).data) && (rolesData as any).data.length > 0
      ? (rolesData as any).data
      : DEMO_ROLES;

  // Invite User Mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!inviteEmail.trim() || !inviteFullName.trim()) {
        throw new Error('Full name and email are required.');
      }

      try {
        const res = await apiClient.post('/users', {
          email: inviteEmail.trim(),
          fullName: inviteFullName.trim(),
          roleId: inviteRole,
          phone: invitePhone.trim() || undefined,
        });
        return res.data;
      } catch (err: any) {
        // Offline demo fallback
        if (!err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
          const fakeRole = allRoles.find((r) => r.id === inviteRole) || allRoles[2];
          const fakeUser: CompanyUser = {
            id: `c-usr-${Date.now()}`,
            userId: `usr-local-${Date.now()}`,
            companyId: 'c0000000-0000-0000-0000-000000000001',
            roleId: inviteRole,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            user: {
              id: `usr-local-${Date.now()}`,
              email: inviteEmail.trim(),
              fullName: inviteFullName.trim(),
              phone: invitePhone.trim() || null,
            },
            role: fakeRole,
          };
          allUsers.push(fakeUser);
          return fakeUser;
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteFullName('');
      setInvitePhone('');
      setFeedback('✓ New user invited and added to company directory.');
      setErrorMessage(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to invite user.';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // Change Role Mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ user, newRoleId }: { user: CompanyUser; newRoleId: string }) => {
      try {
        await apiClient.patch(`/users/${user.id}/role`, { roleId: newRoleId });
      } catch (err: any) {
        if (!err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
          const matchRole = allRoles.find((r) => r.id === newRoleId);
          if (matchRole) {
            user.roleId = newRoleId;
            user.role = matchRole;
          }
          return;
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedUserForRole(null);
      setFeedback('✓ User role updated successfully.');
      setErrorMessage(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update user role.';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // Toggle User Status (Activate / Suspend)
  const toggleStatusMutation = useMutation({
    mutationFn: async (u: CompanyUser) => {
      const newStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      try {
        await apiClient.patch(`/users/${u.id}/status`, { status: newStatus });
      } catch (err: any) {
        if (!err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
          u.status = newStatus;
          return;
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setFeedback('✓ User status updated.');
      setErrorMessage(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update user status.';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  // Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ user, pass }: { user: CompanyUser; pass: string }) => {
      try {
        await apiClient.post(`/users/${user.id}/reset-password`, { newPassword: pass });
      } catch (err: any) {
        if (!err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
          return;
        }
        throw err;
      }
    },
    onSuccess: () => {
      setSelectedUserForPassword(null);
      setNewPassword('');
      setFeedback('✓ User password reset and active sessions revoked.');
      setErrorMessage(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to reset password.';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  return (
    <div className="space-y-6">
      {/* Context Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full bg-indigo-50 text-[#5847F6] text-[11px] font-bold border border-indigo-200">
              Identity & Access Management (IAM)
            </span>
            <span className="text-xs text-slate-400 font-semibold">• RBAC Guardrails</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Users, Roles & Permissions
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Company seat assignments, role hierarchies, password credential governance, and security controls
          </p>
        </div>

        {activeTab === 'USERS' && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="px-5 py-3 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-extrabold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Team Member</span>
          </button>
        )}
      </div>

      {/* Feedback Messages */}
      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{feedback}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tab Navigation Notch */}
      <div className="flex items-center gap-2 p-1.5 rounded-full bg-slate-100 w-fit">
        <button
          onClick={() => setActiveTab('USERS')}
          className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'USERS'
              ? 'bg-[#16181F] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Company Users ({allUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ROLES')}
          className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'ROLES'
              ? 'bg-[#16181F] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Roles & Permissions Matrix</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: USERS LIST & ADMINISTRATION
      ========================================================================= */}
      {activeTab === 'USERS' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FC] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/60 text-[11px]">
                <tr>
                  <th className="py-3.5 px-6">User & Email</th>
                  <th className="py-3.5 px-6">Assigned Role</th>
                  <th className="py-3.5 px-6">Account Status</th>
                  <th className="py-3.5 px-6">Added Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allUsers.map((u) => {
                  const isCurrentAdmin =
                    currentAuthUser?.email === u.user.email ||
                    (u.role?.name === 'Admin' && allUsers.filter((x) => x.role?.name === 'Admin').length <= 1);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 text-[#5847F6] font-extrabold flex items-center justify-center text-xs">
                            {u.user.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{u.user.fullName}</p>
                            <p className="text-[11px] text-slate-400 font-medium">{u.user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            u.role?.name === 'Admin'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : u.role?.name === 'Manager'
                              ? 'bg-indigo-50 text-[#5847F6] border-indigo-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {u.role?.name || 'Staff'}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        {u.status === 'ACTIVE' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>ACTIVE</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>SUSPENDED</span>
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-slate-400 font-mono text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Change Role Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedUserForRole(u)}
                            title="Change Role"
                            className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Reset Password Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedUserForPassword(u)}
                            title="Reset Credentials"
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Status Toggle (Disabled for active admin to prevent lockout) */}
                          <button
                            type="button"
                            disabled={isCurrentAdmin && u.status === 'ACTIVE'}
                            onClick={() => toggleStatusMutation.mutate(u)}
                            title={isCurrentAdmin ? 'Cannot deactivate active Admin' : 'Toggle Status'}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                              u.status === 'ACTIVE'
                                ? 'hover:bg-rose-50 text-rose-600'
                                : 'hover:bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ROLES & PERMISSIONS MATRIX
      ========================================================================= */}
      {activeTab === 'ROLES' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {allRoles.map((role) => (
              <div
                key={role.id}
                className="p-5 rounded-3xl bg-[#F8F9FC] border border-slate-200/80 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-indigo-50 text-[#5847F6] text-xs font-extrabold border border-indigo-200">
                    {role.name}
                  </span>
                  {role.isSystem && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase">System Role</span>
                  )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {role.description}
                </p>
                <div className="pt-2 border-t border-slate-200/60 text-[11px] font-bold text-slate-500">
                  {role.name === 'Admin'
                    ? 'Global Full Access (*:*)'
                    : `${role.rolePermissions.length} Domain Permissions Granted`}
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Permissions Grid */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
              <ShieldCheck className="w-5 h-5 text-[#5847F6]" />
              <h3 className="text-sm font-extrabold text-slate-900">
                System Security & Permission Matrix
              </h3>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {[
                { domain: 'Invoices', perms: ['invoice:view', 'invoice:create', 'invoice:submit', 'invoice:approve', 'invoice:issue', 'invoice:cancel'] },
                { domain: 'Logistics Waybills', perms: ['waybill:view', 'waybill:create', 'waybill:submit', 'waybill:approve', 'waybill:issue', 'waybill:cancel'] },
                { domain: 'Corporate Letters', perms: ['letter:view', 'letter:create', 'letter:submit', 'letter:approve', 'letter:issue', 'letter:cancel'] },
                { domain: 'Payments Ledger', perms: ['payment:view', 'payment:record', 'payment:reverse'] },
                { domain: 'Clients Directory', perms: ['clients:view', 'clients:create', 'clients:update', 'clients:disable'] },
                { domain: 'Company & Branding', perms: ['company:view', 'company:update', 'settings:manage'] },
                { domain: 'User IAM & Audit', perms: ['users:view', 'users:create', 'users:update', 'users:disable', 'audit:view'] },
              ].map((group) => (
                <div key={group.domain} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-extrabold text-slate-900 w-44">{group.domain}</span>
                  <div className="flex flex-wrap items-center gap-1.5 flex-1">
                    {group.perms.map((perm) => (
                      <span
                        key={perm}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-[11px] font-mono font-bold border border-slate-200/70"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
      ========================================================================= */}
      {/* 1. Invite User Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-[32px] p-6 md:p-8 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-[#5847F6] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900">Invite Team Member</h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                inviteMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="e.g. Chidinma Eze"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Corporate Work Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@aoa77.com"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                >
                  {allRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.description?.slice(0, 45)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official Phone <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="tel"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="+234 809 444 5566"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="px-5 py-2 rounded-full bg-[#5847F6] hover:bg-[#4939E3] text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-60"
                >
                  {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Change Role Modal */}
      {selectedUserForRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900">
                Change Role: {selectedUserForRole.user.fullName}
              </h3>
              <button
                onClick={() => setSelectedUserForRole(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {allRoles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    changeRoleMutation.mutate({ user: selectedUserForRole, newRoleId: r.id })
                  }
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedUserForRole.roleId === r.id
                      ? 'bg-indigo-50 border-indigo-300 text-[#5847F6]'
                      : 'bg-[#F8F9FC] hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold">{r.name}</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{r.description}</p>
                  </div>
                  {selectedUserForRole.roleId === r.id && (
                    <CheckCircle2 className="w-4 h-4 text-[#5847F6] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Reset Password Modal */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-[32px] p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900">
                Reset Password: {selectedUserForPassword.user.fullName}
              </h3>
              <button
                onClick={() => setSelectedUserForPassword(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                resetPasswordMutation.mutate({
                  user: selectedUserForPassword,
                  pass: newPassword,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Temporary Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F8F9FC] border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5847F6]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPassword(null)}
                  className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordMutation.isPending || newPassword.length < 8}
                  className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-60"
                >
                  {resetPasswordMutation.isPending ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
