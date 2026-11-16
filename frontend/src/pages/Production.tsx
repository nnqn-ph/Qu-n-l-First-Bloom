import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatCurrency, formatDateTime, formatQuantity } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import {
  Factory,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Play,
  XCircle,
  AlertTriangle,
  Boxes,
  X,
  AlertCircle,
  Eye,
  Check,
} from 'lucide-react';

interface ProductionOrderItem {
  id: string;
  code: string;
  type: 'MAKE_TO_STOCK' | 'MAKE_TO_ORDER';
  status: 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  plannedQuantity: number;
  completedQuantity: number;
  totalProductionCost: number;
  unitProductionCost: number;
  startDate: string | null;
  completedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    sku: string;
    name: string;
    type: 'FINISHED' | 'INTERMEDIATE';
    sellingPrice: number;
  };
  recipe: {
    id: string;
    version: number;
    name: string;
    expectedCost: number;
  };
  createdBy: { id: string; fullName: string; username: string };
  linkedOrder?: { id: string; code: string } | null;
  consumptionsCount: number;
}

interface ProductionOrderDetail extends ProductionOrderItem {
  product: any;
  consumptions: Array<{
    id: string;
    itemType: 'MATERIAL' | 'SUB_PRODUCT';
    materialId?: string;
    subProductId?: string;
    name: string;
    sku: string;
    unit: string;
    plannedQuantity: number;
    actualQuantity: number;
    unitCostSnapshot: number;
    totalCost: number;
    currentStock: number;
  }>;
  stockDocuments: Array<{
    id: string;
    code: string;
    type: string;
    createdAt: string;
    itemsCount: number;
  }>;
}

export function ProductionPage() {
  const { user } = useAuth();
  const isAdmin = user?.roleId === 'ADMIN';
  const queryClient = useQueryClient();

  // Filter state
  const [activeTab, setActiveTab] = useState<'ALL' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Create Form state
  const [createForm, setCreateForm] = useState({
    productId: '',
    recipeId: '',
    type: 'MAKE_TO_STOCK' as 'MAKE_TO_STOCK' | 'MAKE_TO_ORDER',
    plannedQuantity: 10,
    notes: '',
  });

  // Complete Form state
  const [completeForm, setCompleteForm] = useState({
    completedQuantity: 0,
    additionalCost: 0,
    notes: '',
  });

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const { data: orders = [], isLoading: isLoadingOrders } = useQuery<ProductionOrderItem[]>({
    queryKey: ['production-orders', activeTab, searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (activeTab !== 'ALL') params.status = activeTab;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await api.get('/production', { params });
      return res.data.data;
    },
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/products');
      return res.data.data;
    },
  });

  // Selected Order Detail
  const { data: orderDetail } = useQuery<ProductionOrderDetail>({
    queryKey: ['production-order-detail', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null as any;
      const res = await api.get(`/production/${selectedOrderId}`);
      return res.data.data;
    },
    enabled: !!selectedOrderId,
  });

  // Realtime Material Availability Check during creation
  const { data: availabilityCheck } = useQuery({
    queryKey: ['material-check', createForm.productId, createForm.plannedQuantity, createForm.recipeId],
    queryFn: async () => {
      if (!createForm.productId || createForm.plannedQuantity <= 0) return null;
      try {
        const res = await api.post('/production/check-availability', {
          productId: createForm.productId,
          quantity: createForm.plannedQuantity,
          recipeId: createForm.recipeId || undefined,
        });
        return res.data.data;
      } catch (e) {
        return null;
      }
    },
    enabled: isCreateModalOpen && !!createForm.productId && createForm.plannedQuantity > 0,
  });

  // ==========================================
  // MUTATIONS
  // ==========================================

  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post('/production', payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      setIsCreateModalOpen(false);
      setSelectedOrderId(res.data.data.id);
      resetCreateForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Lỗi khi tạo lệnh sản xuất');
    },
  });

  const startProductionMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return api.post(`/production/${id}/start`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Lỗi khi bắt đầu sản xuất');
    },
  });

  const completeProductionMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      return api.post(`/production/${id}/complete`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory'] });
      setIsCompleteModalOpen(false);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Lỗi khi hoàn thành sản xuất');
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return api.post(`/production/${id}/cancel`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Lỗi khi hủy lệnh sản xuất');
    },
  });

  // Helpers
  const resetCreateForm = () => {
    setCreateForm({
      productId: products[0]?.id || '',
      recipeId: '',
      type: 'MAKE_TO_STOCK',
      plannedQuantity: 10,
      notes: '',
    });
    setFormError(null);
  };

  const handleOpenCreateModal = () => {
    resetCreateForm();
    if (products.length > 0) {
      setCreateForm((prev) => ({ ...prev, productId: products[0].id }));
    }
    setIsCreateModalOpen(true);
  };

  const handleOpenCompleteModal = (order: ProductionOrderDetail) => {
    setCompleteForm({
      completedQuantity: order.plannedQuantity,
      additionalCost: 0,
      notes: '',
    });
    setIsCompleteModalOpen(true);
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!createForm.productId) {
      setFormError('Vui lòng chọn sản phẩm cần sản xuất');
      return;
    }
    if (createForm.plannedQuantity <= 0) {
      setFormError('Số lượng kế hoạch phải lớn hơn 0');
      return;
    }

    createOrderMutation.mutate({
      productId: createForm.productId,
      recipeId: createForm.recipeId || undefined,
      type: createForm.type,
      plannedQuantity: Number(createForm.plannedQuantity),
      notes: createForm.notes.trim() || undefined,
    });
  };

  // Metrics
  const totalOrdersCount = orders.length;
  const inProgressCount = orders.filter((o) => o.status === 'IN_PROGRESS').length;
  const plannedCount = orders.filter((o) => o.status === 'PLANNED').length;
  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-sage-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-700">
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-forest-900">
              Quản lý Lệnh Sản Xuất (Production Orders)
            </h1>
            <p className="text-sm text-forest-600">
              Mô hình Make-to-Stock & Make-to-Order, kiểm tra nguyên liệu tự động và luân chuyển giá vốn
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm flex items-center gap-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Tạo Lệnh Sản Xuất Mới
          </button>
        )}
      </div>

      {/* 2. Stats KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng số lệnh</span>
            <Factory className="w-5 h-5 text-sage-600" />
          </div>
          <div className="text-2xl font-bold text-forest-900">{totalOrdersCount}</div>
          <div className="text-xs text-forest-500 mt-1">Lệnh đã lập trên hệ thống</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Đang sản xuất</span>
            <Play className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{inProgressCount}</div>
          <div className="text-xs text-forest-500 mt-1">Đã xuất kho nguyên liệu</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Chờ sản xuất</span>
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-700">{plannedCount}</div>
          <div className="text-xs text-forest-500 mt-1">Đang chờ xuất kho vật liệu</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Đã hoàn thành</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{completedCount}</div>
          <div className="text-xs text-forest-500 mt-1">Đã nhập kho thành phẩm</div>
        </div>
      </div>

      {/* 3. Filter Bar & Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-sage-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap bg-cream-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'ALL'
                ? 'bg-white text-forest-900 shadow-sm font-semibold'
                : 'text-forest-600 hover:text-forest-900'
            }`}
          >
            Tất cả ({totalOrdersCount})
          </button>
          <button
            onClick={() => setActiveTab('PLANNED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'PLANNED'
                ? 'bg-white text-forest-900 shadow-sm font-semibold'
                : 'text-forest-600 hover:text-forest-900'
            }`}
          >
            Chờ xuất kho ({plannedCount})
          </button>
          <button
            onClick={() => setActiveTab('IN_PROGRESS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'IN_PROGRESS'
                ? 'bg-white text-forest-900 shadow-sm font-semibold'
                : 'text-forest-600 hover:text-forest-900'
            }`}
          >
            Đang sản xuất ({inProgressCount})
          </button>
          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'COMPLETED'
                ? 'bg-white text-forest-900 shadow-sm font-semibold'
                : 'text-forest-600 hover:text-forest-900'
            }`}
          >
            Đã hoàn thành ({completedCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
          <input
            type="text"
            placeholder="Tìm theo mã lệnh, sản phẩm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800 placeholder-forest-400"
          />
        </div>
      </div>

      {/* 4. Production Orders Table */}
      <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream-100 text-forest-700 font-semibold border-b border-sage-200">
              <tr>
                <th className="py-3.5 px-4">Mã lệnh</th>
                <th className="py-3.5 px-4">Sản phẩm cần sản xuất</th>
                <th className="py-3.5 px-4">Mô hình</th>
                <th className="py-3.5 px-4 text-center">Tiến độ (Hoàn thành / KH)</th>
                <th className="py-3.5 px-4 text-right">Chi phí sản xuất</th>
                <th className="py-3.5 px-4 text-center">Trạng thái</th>
                <th className="py-3.5 px-4">Ngày tạo</th>
                <th className="py-3.5 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage-100 text-forest-800">
              {isLoadingOrders ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-forest-400">
                    Đang tải danh sách lệnh sản xuất...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-forest-400">
                    Chưa có lệnh sản xuất nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  return (
                    <tr key={o.id} className="hover:bg-cream-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-semibold text-sage-800">
                        {o.code}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-forest-900">{o.product.name}</div>
                        <div className="text-xs text-forest-400 font-mono">
                          {o.product.sku} • BOM: {o.recipe.name} (v{o.recipe.version})
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {o.type === 'MAKE_TO_STOCK' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            Lưu kho (MTS)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            Theo đơn (MTO)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="font-bold text-forest-900">
                            {formatQuantity(o.completedQuantity)} / {formatQuantity(o.plannedQuantity)}
                          </span>
                          <div className="w-20 bg-cream-200 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div
                              className="bg-sage-600 h-1.5 rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (o.completedQuantity / o.plannedQuantity) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {o.status === 'COMPLETED' ? (
                          <div>
                            <div className="font-bold text-forest-900">
                              {formatCurrency(o.totalProductionCost)}
                            </div>
                            <div className="text-[10px] text-forest-400">
                              {formatCurrency(o.unitProductionCost)} / cái
                            </div>
                          </div>
                        ) : o.status === 'IN_PROGRESS' ? (
                          <div>
                            <div className="font-medium text-amber-700">
                              {formatCurrency(o.totalProductionCost)}
                            </div>
                            <div className="text-[10px] text-forest-400">Chi phí NVL xuất kho</div>
                          </div>
                        ) : (
                          <span className="text-xs text-forest-400">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {o.status === 'PLANNED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            <Clock className="w-3 h-3" /> Chờ xuất kho
                          </span>
                        )}
                        {o.status === 'IN_PROGRESS' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <Play className="w-3 h-3" /> Đang sản xuất
                          </span>
                        )}
                        {o.status === 'COMPLETED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Hoàn thành
                          </span>
                        )}
                        {o.status === 'CANCELLED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            <XCircle className="w-3 h-3" /> Đã hủy
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-forest-500">
                        {formatDateTime(o.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedOrderId(o.id)}
                          className="px-3 py-1.5 rounded-xl border border-sage-300 hover:bg-cream-100 text-forest-700 text-xs font-medium inline-flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-sage-600" />
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================== */}
      {/* 5. MODAL CHI TIẾT LỆNH SẢN XUẤT            */}
      {/* ========================================== */}
      {selectedOrderId && orderDetail && (
        <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-sage-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <Factory className="w-6 h-6 text-sage-600" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif font-bold text-lg text-forest-900">
                      Lệnh sản xuất {orderDetail.code}
                    </h3>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cream-200 text-forest-800">
                      {orderDetail.type === 'MAKE_TO_STOCK' ? 'LƯU KHO (MTS)' : 'THEO ĐƠN (MTO)'}
                    </span>
                  </div>
                  <p className="text-xs text-forest-500">
                    Sản phẩm: <strong>{orderDetail.product.name}</strong> ({orderDetail.product.sku}) • Lập bởi {orderDetail.createdBy.fullName}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrderId(null)}
                className="p-2 text-forest-400 hover:text-forest-700 rounded-xl hover:bg-cream-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Status Banner */}
              <div className="p-4 rounded-2xl bg-cream-50 border border-sage-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-forest-500">Trạng thái hiện tại:</div>
                  <div className="text-base font-bold text-forest-900 flex items-center gap-2 mt-0.5">
                    {orderDetail.status === 'PLANNED' && (
                      <span className="text-blue-700">Chờ xuất kho nguyên liệu sản xuất</span>
                    )}
                    {orderDetail.status === 'IN_PROGRESS' && (
                      <span className="text-amber-700">Đang sản xuất (Đã xuất vật liệu lúc {formatDateTime(orderDetail.startDate)})</span>
                    )}
                    {orderDetail.status === 'COMPLETED' && (
                      <span className="text-emerald-700">Đã hoàn thành nhập kho thành phẩm lúc {formatDateTime(orderDetail.completedDate)}</span>
                    )}
                    {orderDetail.status === 'CANCELLED' && (
                      <span className="text-gray-600">Lệnh đã bị hủy</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons for Admin */}
                {isAdmin && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {orderDetail.status === 'PLANNED' && (
                      <button
                        onClick={() => {
                          if (window.confirm('Bắt đầu sản xuất? Hệ thống sẽ tự động trừ kho nguyên vật liệu theo định mức BOM.')) {
                            startProductionMutation.mutate({ id: orderDetail.id });
                          }
                        }}
                        disabled={startProductionMutation.isPending}
                        className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Xuất kho & Bắt đầu sản xuất
                      </button>
                    )}

                    {orderDetail.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleOpenCompleteModal(orderDetail)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Hoàn thành & Nhập kho thành phẩm
                      </button>
                    )}

                    {orderDetail.status !== 'COMPLETED' && orderDetail.status !== 'CANCELLED' && (
                      <button
                        onClick={() => {
                          const reason = prompt('Nhập lý do hủy lệnh sản xuất:');
                          if (reason && reason.trim()) {
                            cancelOrderMutation.mutate({ id: orderDetail.id, reason: reason.trim() });
                          }
                        }}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition"
                      >
                        Hủy lệnh
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Progress & Cost summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-cream-100 p-4 rounded-2xl">
                <div>
                  <div className="text-xs text-forest-500">Số lượng kế hoạch</div>
                  <div className="text-lg font-bold text-forest-900">
                    {formatQuantity(orderDetail.plannedQuantity)} cái
                  </div>
                </div>

                <div>
                  <div className="text-xs text-forest-500">Số lượng hoàn thành</div>
                  <div className="text-lg font-bold text-emerald-700">
                    {formatQuantity(orderDetail.completedQuantity)} cái
                  </div>
                </div>

                <div>
                  <div className="text-xs text-forest-500">Tổng chi phí sản xuất</div>
                  <div className="text-lg font-bold text-forest-900">
                    {formatCurrency(orderDetail.totalProductionCost)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-forest-500">Giá vốn thực tế / cái</div>
                  <div className="text-lg font-bold text-forest-900">
                    {formatCurrency(orderDetail.unitProductionCost)}
                  </div>
                </div>
              </div>

              {/* Material Consumptions Table */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-forest-900 flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-sage-600" />
                  Định mức nguyên vật liệu & Bán thành phẩm tiêu hao
                </h4>

                <div className="overflow-x-auto rounded-2xl border border-sage-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-cream-100 text-forest-700 font-semibold border-b border-sage-200">
                      <tr>
                        <th className="py-3 px-3">Loại</th>
                        <th className="py-3 px-3">Mã SKU & Tên vật tư</th>
                        <th className="py-3 px-3 text-right">Số lượng cần xuất</th>
                        <th className="py-3 px-3 text-right">Tồn kho hiện tại</th>
                        <th className="py-3 px-3 text-right">Đơn giá vốn xuất</th>
                        <th className="py-3 px-3 text-right">Thành tiền</th>
                        <th className="py-3 px-3 text-center">Khả dụng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sage-100 text-forest-800">
                      {orderDetail.consumptions.map((c) => {
                        const isSufficient = c.currentStock >= c.plannedQuantity;
                        return (
                          <tr key={c.id} className="hover:bg-cream-50/50">
                            <td className="py-3 px-3">
                              {c.itemType === 'MATERIAL' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sage-100 text-sage-800 text-[11px] font-medium">
                                  Nguyên liệu
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-medium">
                                  Bán thành phẩm
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-semibold text-forest-900">
                              {c.name}
                              <div className="text-[10px] text-forest-400 font-mono">{c.sku}</div>
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-forest-900">
                              {formatQuantity(c.plannedQuantity)} {c.unit}
                            </td>
                            <td className="py-3 px-3 text-right font-medium">
                              {formatQuantity(c.currentStock)} {c.unit}
                            </td>
                            <td className="py-3 px-3 text-right text-forest-600">
                              {formatCurrency(c.unitCostSnapshot)}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-forest-900">
                              {formatCurrency(c.totalCost || c.plannedQuantity * c.unitCostSnapshot)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {orderDetail.status !== 'PLANNED' ? (
                                <span className="text-emerald-700 font-semibold text-[11px]">Đã xuất kho</span>
                              ) : isSufficient ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                  <Check className="w-3.5 h-3.5" /> Đủ hàng
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-[11px]">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Thiếu {(c.plannedQuantity - c.currentStock).toFixed(1)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {orderDetail.notes && (
                <div className="p-3 bg-cream-50 rounded-xl border border-sage-200 text-xs text-forest-700 whitespace-pre-line">
                  <span className="font-semibold text-forest-900">Ghi chú sản xuất: </span>
                  {orderDetail.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 6. MODAL TẠO LỆNH SẢN XUẤT MỚI            */}
      {/* ========================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-6 border-b border-sage-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-sage-600" />
                <h3 className="font-serif font-bold text-lg text-forest-900">
                  Lập Lệnh Sản Xuất Mới
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-forest-400 hover:text-forest-700 rounded-xl hover:bg-cream-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Product & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Sản phẩm sản xuất <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={createForm.productId}
                    onChange={(e) => setCreateForm({ ...createForm, productId: e.target.value })}
                    className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                    required
                  >
                    <option value="" disabled>
                      Chọn sản phẩm
                    </option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.sku}] {p.name} ({p.type === 'FINISHED' ? 'Thành phẩm' : 'Bán TP'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Mô hình sản xuất <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={createForm.type}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        type: e.target.value as 'MAKE_TO_STOCK' | 'MAKE_TO_ORDER',
                      })
                    }
                    className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                  >
                    <option value="MAKE_TO_STOCK">Sản xuất lưu kho (Make to Stock)</option>
                    <option value="MAKE_TO_ORDER">Sản xuất theo đơn đặt hàng (Make to Order)</option>
                  </select>
                </div>
              </div>

              {/* Planned Quantity */}
              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Số lượng cần sản xuất (cái / bó) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={createForm.plannedQuantity}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, plannedQuantity: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm font-bold text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  required
                />
              </div>

              {/* Real-time Material Availability Preview */}
              {availabilityCheck && (
                <div className="p-4 rounded-2xl border space-y-3 bg-cream-50 border-sage-200">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-forest-800">
                      Kiểm tra tồn kho vật tư (Công thức: {availabilityCheck.recipeName} v{availabilityCheck.recipeVersion}):
                    </span>
                    {availabilityCheck.isAllAvailable ? (
                      <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Đủ nguyên liệu trong kho
                      </span>
                    ) : (
                      <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Thiếu {availabilityCheck.missingItems.length} loại vật tư
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {availabilityCheck.items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-xl text-xs flex items-center justify-between ${
                          item.isSufficient ? 'bg-white' : 'bg-rose-50 border border-rose-200'
                        }`}
                      >
                        <div>
                          <span className="font-semibold text-forest-900">{item.name}</span>
                          <span className="text-[10px] text-forest-400 font-mono ml-1.5">[{item.sku}]</span>
                        </div>
                        <div className="text-right">
                          <span className="text-forest-600">
                            Cần: <strong>{formatQuantity(item.totalNeeded)}</strong> {item.unit} / Tồn:{' '}
                            <strong className={item.isSufficient ? 'text-forest-900' : 'text-rose-600'}>
                              {formatQuantity(item.inStock)}
                            </strong>
                          </span>
                          {!item.isSufficient && (
                            <span className="text-rose-600 font-bold block text-[10px]">
                              (Thiếu: {formatQuantity(item.missingQuantity)} {item.unit})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">Ghi chú sản xuất</label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú người phụ trách, tiến độ hoặc lưu ý uốn hoa..."
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-sage-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-sage-300 text-forest-700 hover:bg-cream-100 font-medium text-sm transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm transition shadow-sm disabled:opacity-50"
                >
                  {createOrderMutation.isPending ? 'Đang tạo...' : 'Xác nhận tạo lệnh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 7. MODAL HOÀN THÀNH SẢN XUẤT               */}
      {/* ========================================== */}
      {isCompleteModalOpen && orderDetail && (
        <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-sage-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-serif font-bold text-lg text-forest-900">
                  Hoàn Thành Sản Xuất & Nhập Kho
                </h3>
              </div>
              <button
                onClick={() => setIsCompleteModalOpen(false)}
                className="p-2 text-forest-400 hover:text-forest-700 rounded-xl hover:bg-cream-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                completeProductionMutation.mutate({
                  id: orderDetail.id,
                  payload: {
                    completedQuantity: Number(completeForm.completedQuantity),
                    additionalCost: Number(completeForm.additionalCost || 0),
                    notes: completeForm.notes.trim() || undefined,
                  },
                });
              }}
              className="p-6 space-y-4"
            >
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                Sản phẩm <strong>{orderDetail.product.name}</strong> sẽ được cộng vào kho thành phẩm. Giá vốn sẽ được tính tự động theo công thức bình quân gia quyền di động (MWAC).
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Số lượng thành phẩm thực tế hoàn thành <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={completeForm.completedQuantity}
                  onChange={(e) =>
                    setCompleteForm({ ...completeForm, completedQuantity: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm font-bold text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Chi phí phụ trợ phát sinh (nhân công / bao bì ngoài BOM) (VNĐ)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={completeForm.additionalCost}
                  onChange={(e) =>
                    setCompleteForm({ ...completeForm, additionalCost: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">Ghi chú nghiệm thu</label>
                <input
                  type="text"
                  placeholder="Ghi chú về chất lượng thành phẩm..."
                  value={completeForm.notes}
                  onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-sage-200">
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-sage-300 text-forest-700 hover:bg-cream-100 font-medium text-sm transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={completeProductionMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-sm disabled:opacity-50"
                >
                  {completeProductionMutation.isPending ? 'Đang xử lý...' : 'Xác nhận nhập kho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
