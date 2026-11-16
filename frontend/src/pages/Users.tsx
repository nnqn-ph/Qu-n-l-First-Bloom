import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';
import { 
  UserCog, 
  Plus, 
  Search, 
  ShieldCheck, 
  Smartphone, 
  Lock, 
  Unlock, 
  X, 
  AlertCircle,
  Phone,
  User as UserIcon,
  Key
} from 'lucide-react';

interface UserItem {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  roleId: 'ADMIN' | 'STAFF';
  roleName: string;
  isActive: boolean;
  activeSessionsCount: number;
  totalOrdersCount: number;
  createdAt: string;
}

export const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form states for Create User
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState<'ADMIN' | 'STAFF'>('STAFF');
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Fetch Users List
  const { data: users = [], isLoading } = useQuery<UserItem[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/v1/users');
      return res.data.data;
    },
  });

  // 2. Toggle Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await api.patch(`/v1/users/${id}/status`, { isActive });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái');
    },
  });

  // 3. Create User Mutation
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/v1/users', { username, password, fullName, phone, roleId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateModalOpen(false);
      setUsername('');
      setPassword('');
      setFullName('');
      setPhone('');
      setRoleId('STAFF');
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Lỗi khi tạo tài khoản');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !fullName) {
      setFormError('Vui lòng điền các trường bắt buộc');
      return;
    }
    createUserMutation.mutate();
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      (u.phone && u.phone.includes(term))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-forest-900 flex items-center gap-2.5">
            <UserCog className="w-6 h-6 text-sage-600" />
            <span>Quản lý Nhân sự & Phân quyền</span>
          </h2>
          <p className="text-xs text-forest-600 mt-1">
            Quản lý tài khoản đăng nhập chung cơ sở dữ liệu, phân quyền Admin và Nhân viên
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold shadow-md shadow-sage-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm nhân viên mới</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-sage-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-forest-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên nhân viên, username hoặc số điện thoại..."
            className="w-full pl-10 pr-4 py-2 bg-cream-50/50 border border-sage-200 rounded-xl text-xs text-forest-900 placeholder-forest-500/60 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-cream-50/80 border-b border-sage-200 text-forest-700 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Nhân viên</th>
                <th className="py-3.5 px-4">Tên đăng nhập</th>
                <th className="py-3.5 px-4">Vai trò</th>
                <th className="py-3.5 px-4">Thiết bị Online</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4">Ngày tạo</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-forest-500">
                    Đang tải danh sách nhân sự...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-forest-500">
                    Không tìm thấy nhân viên nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-cream-50/50 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-semibold text-forest-900">{user.fullName}</div>
                      <div className="text-[11px] text-forest-500">{user.phone || 'Chưa cập nhật SĐT'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <code className="px-2 py-0.5 rounded bg-sage-50 text-sage-800 font-mono text-[11px] border border-sage-200">
                        {user.username}
                      </code>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] ${
                          user.roleId === 'ADMIN'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-sage-100 text-sage-800 border border-sage-200'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {user.roleName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1 text-forest-700">
                        <Smartphone className="w-3.5 h-3.5 text-sage-600" />
                        <span>{user.activeSessionsCount} thiết bị</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          user.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {user.isActive ? 'Đang hoạt động' : 'Tạm khóa'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-forest-500">
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      {user.roleId !== 'ADMIN' && (
                        <button
                          onClick={() => toggleStatusMutation.mutate({ id: user.id, isActive: !user.isActive })}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium border transition-colors ${
                            user.isActive
                              ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                          }`}
                          title={user.isActive ? 'Khóa tài khoản và hủy phiên' : 'Mở khóa tài khoản'}
                        >
                          {user.isActive ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          <span>{user.isActive ? 'Khóa' : 'Kích hoạt'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm Nhân viên Mới */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-sage-200 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-sage-100 flex items-center justify-between bg-cream-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sage-600 text-white flex items-center justify-center shadow-sm">
                  <UserCog className="w-5 h-5 text-cream-100" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-forest-900">Thêm nhân viên mới</h3>
                  <p className="text-[11px] text-forest-600">Cấp tài khoản đăng nhập hệ thống tiệm hoa</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-forest-500 hover:bg-sage-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">
                  Họ và tên nhân viên <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-forest-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="VD: Lê Thu Thảo"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">
                  Tên đăng nhập (Username) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="VD: thuthao_staff"
                  className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">
                  Mật khẩu khởi tạo <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-forest-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ít nhất 6 ký tự"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">
                  Số điện thoại
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-forest-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="VD: 0912 345 678"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">
                  Vai trò phân quyền
                </label>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                >
                  <option value="STAFF">Nhân viên bán hàng (Chỉ quản lý đơn & khách hàng)</option>
                  <option value="ADMIN">Chủ tiệm / Quản lý cấp cao (Toàn quyền)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-sage-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-forest-600 hover:bg-sage-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-sage-600 text-white hover:bg-sage-700 shadow-sm disabled:opacity-60"
                >
                  {createUserMutation.isPending ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
