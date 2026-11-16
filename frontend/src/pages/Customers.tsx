import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/format';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  ShoppingBag,
  DollarSign,
  Edit3,
  X,
  AlertCircle,
  Eye,
} from 'lucide-react';

interface CustomerItem {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  address: string | null;
  notes: string | null;
  totalOrdersCount: number;
  totalSpent: number;
  createdAt: string;
}

interface CustomerDetail extends CustomerItem {
  orders: Array<{
    id: string;
    code: string;
    orderDate: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
  }>;
}

export function CustomersPage() {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [customerForm, setCustomerForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    notes: '',
  });

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const { data: customers = [], isLoading } = useQuery<CustomerItem[]>({
    queryKey: ['customers', searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await api.get('/customers', { params });
      return res.data.data;
    },
  });

  const { data: customerDetail } = useQuery<CustomerDetail>({
    queryKey: ['customer-detail', selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return null as any;
      const res = await api.get(`/customers/${selectedCustomerId}`);
      return res.data.data;
    },
    enabled: !!selectedCustomerId,
  });

  // ==========================================
  // MUTATIONS
  // ==========================================

  const createCustomerMutation = useMutation({
    mutationFn: async (payload: typeof customerForm) => {
      return api.post('/customers', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Lỗi khi tạo khách hàng');
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: typeof customerForm }) => {
      return api.patch(`/customers/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Lỗi khi cập nhật khách hàng');
    },
  });

  const resetForm = () => {
    setCustomerForm({ fullName: '', phone: '', address: '', notes: '' });
    setEditingCustomer(null);
    setFormError(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: CustomerItem) => {
    setEditingCustomer(c);
    setCustomerForm({
      fullName: c.fullName,
      phone: c.phone,
      address: c.address || '',
      notes: c.notes || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerForm.fullName.trim()) {
      setFormError('Vui lòng nhập họ tên khách hàng');
      return;
    }
    if (!customerForm.phone.trim()) {
      setFormError('Vui lòng nhập số điện thoại');
      return;
    }

    if (editingCustomer) {
      updateCustomerMutation.mutate({ id: editingCustomer.id, payload: customerForm });
    } else {
      createCustomerMutation.mutate(customerForm);
    }
  };

  // Metrics
  const totalCustomers = customers.length;
  const loyalCustomers = customers.filter((c) => c.totalOrdersCount >= 2).length;
  const totalSpentAll = customers.reduce((sum, c) => sum + c.totalSpent, 0);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-sage-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-700">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-forest-900">
              Quản lý Khách Hàng
            </h1>
            <p className="text-sm text-forest-600">
              Hồ sơ khách hàng, số điện thoại, địa chỉ nhận hoa và lịch sử chi tiêu
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Thêm Khách Hàng Mới
        </button>
      </div>

      {/* 2. Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng khách hàng</span>
            <Users className="w-5 h-5 text-sage-600" />
          </div>
          <div className="text-2xl font-bold text-forest-900">{totalCustomers}</div>
          <div className="text-xs text-forest-500 mt-1">Khách đã lưu trên hệ thống</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Khách thân thiết</span>
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{loyalCustomers}</div>
          <div className="text-xs text-forest-500 mt-1">Đã mua từ 2 đơn hàng trở lên</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng doanh số từ khách</span>
            <DollarSign className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-forest-900">{formatCurrency(totalSpentAll)}</div>
          <div className="text-xs text-forest-500 mt-1">Toàn bộ giá trị đơn hàng tích lũy</div>
        </div>
      </div>

      {/* 3. Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-sage-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, SĐT hoặc mã khách..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800 placeholder-forest-400"
          />
        </div>
      </div>

      {/* 4. Customers Table */}
      <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream-100 text-forest-700 font-semibold border-b border-sage-200">
              <tr>
                <th className="py-3.5 px-4">Mã KH</th>
                <th className="py-3.5 px-4">Họ và tên</th>
                <th className="py-3.5 px-4">Số điện thoại</th>
                <th className="py-3.5 px-4">Địa chỉ giao hàng</th>
                <th className="py-3.5 px-4 text-center">Số đơn</th>
                <th className="py-3.5 px-4 text-right">Tổng chi tiêu</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage-100 text-forest-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-forest-400">
                    Đang tải danh sách khách hàng...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-forest-400">
                    Chưa có khách hàng nào trong hệ thống.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-cream-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold text-sage-800">
                      {c.code}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-forest-900">{c.fullName}</div>
                      {c.notes && (
                        <div className="text-[11px] text-forest-400 truncate max-w-xs">
                          {c.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-forest-700">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3 text-sage-600" />
                        {c.phone}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-forest-600 max-w-xs truncate">
                      {c.address ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-forest-400 flex-shrink-0" />
                          {c.address}
                        </span>
                      ) : (
                        <span className="text-forest-400 italic">Chưa có địa chỉ</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold text-forest-900">
                      {c.totalOrdersCount}
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                      {formatCurrency(c.totalSpent)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedCustomerId(c.id)}
                          className="p-1.5 rounded-lg text-sage-600 hover:bg-sage-100 transition"
                          title="Xem lịch sử đơn hàng"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          className="p-1.5 rounded-lg text-forest-600 hover:bg-cream-200 transition"
                          title="Sửa thông tin"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================== */}
      {/* 5. MODAL THÊM / SỬA KHÁCH HÀNG             */}
      {/* ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-sage-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-sage-600" />
                <h3 className="font-serif font-bold text-lg text-forest-900">
                  {editingCustomer ? 'Chỉnh sửa Khách Hàng' : 'Thêm Khách Hàng Mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-forest-400 hover:text-forest-700 rounded-xl hover:bg-cream-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Họ và tên khách hàng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Chị Ngọc Mai"
                  value={customerForm.fullName}
                  onChange={(e) => setCustomerForm({ ...customerForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Số điện thoại <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="VD: 0912345678"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Địa chỉ giao hoa mặc định
                </label>
                <input
                  type="text"
                  placeholder="VD: Số 123 Phố Huế, Hai Bà Trưng, Hà Nội"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Ghi chú về khách hàng
                </label>
                <textarea
                  rows={2}
                  placeholder="Sở thích màu hoa, lưu ý giao hàng..."
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-sage-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-sage-300 text-forest-700 hover:bg-cream-100 font-medium text-sm transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createCustomerMutation.isPending || updateCustomerMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm transition shadow-sm disabled:opacity-50"
                >
                  {createCustomerMutation.isPending || updateCustomerMutation.isPending
                    ? 'Đang lưu...'
                    : editingCustomer
                    ? 'Lưu thay đổi'
                    : 'Tạo khách hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 6. MODAL XEM LỊCH SỬ ĐƠN HÀNG CỦA KHÁCH     */}
      {/* ========================================== */}
      {selectedCustomerId && customerDetail && (
        <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b border-sage-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="font-serif font-bold text-lg text-forest-900">
                  Lịch sử mua hàng: {customerDetail.fullName}
                </h3>
                <p className="text-xs text-forest-500 font-mono">
                  {customerDetail.code} • SĐT: {customerDetail.phone}
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="p-2 text-forest-400 hover:text-forest-700 rounded-xl hover:bg-cream-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-cream-50 p-4 rounded-2xl border border-sage-200 text-xs">
                <div>
                  <span className="text-forest-500">Tổng số đơn đã mua:</span>
                  <div className="text-base font-bold text-forest-900 mt-0.5">
                    {customerDetail.totalOrdersCount} đơn
                  </div>
                </div>
                <div>
                  <span className="text-forest-500">Tổng tiền đã chi:</span>
                  <div className="text-base font-bold text-emerald-700 mt-0.5">
                    {formatCurrency(customerDetail.totalSpent)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-forest-700">Các đơn hàng gần nhất</div>
                {customerDetail.orders.length === 0 ? (
                  <div className="text-xs text-forest-400 italic p-4 text-center">Khách hàng chưa có đơn hàng nào.</div>
                ) : (
                  <div className="divide-y divide-sage-100 border border-sage-200 rounded-2xl overflow-hidden">
                    {customerDetail.orders.map((ord) => (
                      <div key={ord.id} className="p-3 text-xs flex items-center justify-between hover:bg-cream-50">
                        <div>
                          <div className="font-mono font-bold text-sage-800">{ord.code}</div>
                          <div className="text-[10px] text-forest-400">{formatDateTime(ord.orderDate)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-forest-900">{formatCurrency(ord.totalAmount)}</div>
                          <div className="text-[10px]">
                            {ord.remainingAmount > 0 ? (
                              <span className="text-amber-700 font-semibold">Còn thiếu: {formatCurrency(ord.remainingAmount)}</span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">Đã thanh toán đủ</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
