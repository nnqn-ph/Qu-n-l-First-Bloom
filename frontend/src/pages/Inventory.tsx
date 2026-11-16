import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatCurrency, formatDateTime, formatQuantity } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import {
  Boxes,
  Search,
  Filter,
  History,
  AlertTriangle,
  CheckCircle2,
  Flower2,
  Sparkles,
  ClipboardList,
  Edit3,
  X,
  AlertCircle,
  Building2,
} from 'lucide-react';

interface ProductInventoryItem {
  id: string;
  sku: string;
  name: string;
  type: 'FINISHED' | 'INTERMEDIATE';
  sellingPrice: number;
  imageUrl: string | null;
  category: { id: string; code: string; name: string };
  inventory: {
    actualQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    avgCost?: number;
    totalInventoryValue?: number;
    isLowStock: boolean;
  };
}

interface ProductStockLedgerItem {
  id: string;
  documentCode: string;
  documentType: string;
  referenceType: string;
  createdAt: string;
  issuedBy: { id: string; fullName: string; username: string };
  product: { id: string; sku: string; name: string; type: string };
  qtyBefore: number;
  qtyChange: number;
  qtyAfter: number;
  unitCost: number;
  totalCost: number;
  notes: string | null;
}

export function InventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.roleId === 'ADMIN';
  const queryClient = useQueryClient();

  // Active view tab
  const [activeTab, setActiveTab] = useState<'STOCK' | 'LEDGER'>('STOCK');

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal Adjust Stock
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<ProductInventoryItem | null>(null);
  const [actualQtyInput, setActualQtyInput] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await api.get('/product-categories');
      return res.data.data;
    },
  });

  const { data: stockItems = [], isLoading: isLoadingStock } = useQuery<ProductInventoryItem[]>({
    queryKey: ['product-inventory', searchQuery, selectedCategory],
    queryFn: async () => {
      const params: any = {};
      if (selectedCategory !== 'ALL') params.categoryId = selectedCategory;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await api.get('/inventory/products', { params });
      return res.data.data;
    },
  });

  const { data: ledgerItems = [], isLoading: isLoadingLedger } = useQuery<ProductStockLedgerItem[]>({
    queryKey: ['product-ledger'],
    queryFn: async () => {
      const res = await api.get('/inventory/products/ledger');
      return res.data.data;
    },
    enabled: activeTab === 'LEDGER' && isAdmin,
  });

  // ==========================================
  // MUTATIONS
  // ==========================================

  const adjustStockMutation = useMutation({
    mutationFn: async (payload: { productId: string; actualQuantity: number; reason: string }) => {
      return api.post('/inventory/products/adjust', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['product-ledger'] });
      setIsAdjustModalOpen(false);
      setAdjustingProduct(null);
      setAdjustReason('');
      setAdjustError(null);
    },
    onError: (err: any) => {
      setAdjustError(err.response?.data?.message || err.message || 'Lỗi khi điều chỉnh tồn kho');
    },
  });

  const handleOpenAdjustModal = (item: ProductInventoryItem) => {
    setAdjustingProduct(item);
    setActualQtyInput(item.inventory.actualQuantity);
    setAdjustReason('');
    setAdjustError(null);
    setIsAdjustModalOpen(true);
  };

  const handleSubmitAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    if (actualQtyInput < 0) {
      setAdjustError('Số lượng tồn kho không được âm');
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustError('Vui lòng nhập lý do kiểm kê điều chỉnh');
      return;
    }

    adjustStockMutation.mutate({
      productId: adjustingProduct.id,
      actualQuantity: Number(actualQtyInput),
      reason: adjustReason.trim(),
    });
  };

  // Metrics
  const totalStockCount = stockItems.reduce((sum, item) => sum + item.inventory.actualQuantity, 0);
  const totalReservedCount = stockItems.reduce((sum, item) => sum + item.inventory.reservedQuantity, 0);
  const totalAvailableCount = Math.max(0, totalStockCount - totalReservedCount);
  const lowStockCount = stockItems.filter((item) => item.inventory.isLowStock).length;
  const totalInventoryValue = stockItems.reduce(
    (sum, item) => sum + (item.inventory.totalInventoryValue || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-sage-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-700">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-forest-900">
              Quản lý Tồn Kho Thành Phẩm
            </h1>
            <p className="text-sm text-forest-600">
              Theo dõi số lượng hoa có sẵn, tồn giữ theo đơn, giá vốn bình quân (MWAC) và thẻ kho
            </p>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex bg-cream-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('STOCK')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'STOCK'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-forest-600 hover:text-forest-900'
            }`}
          >
            <Boxes className="w-4 h-4 text-sage-600" />
            Tồn kho Thành phẩm
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('LEDGER')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                activeTab === 'LEDGER'
                  ? 'bg-white text-forest-900 shadow-sm'
                  : 'text-forest-600 hover:text-forest-900'
              }`}
            >
              <History className="w-4 h-4 text-sage-600" />
              Sổ Thẻ Kho (Ledger)
            </button>
          )}
        </div>
      </div>

      {/* 2. Stats Summary KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Khả dụng bán</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{totalAvailableCount}</div>
          <div className="text-xs text-forest-500 mt-1">Sản phẩm có thể xuất giao ngay</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tồn giữ đơn hàng</span>
            <Building2 className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{totalReservedCount}</div>
          <div className="text-xs text-forest-500 mt-1">Dành cho đơn chưa giao</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sắp hết hàng</span>
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{lowStockCount}</div>
          <div className="text-xs text-forest-500 mt-1">Mặt hàng còn dưới 3 sản phẩm</div>
        </div>

        {isAdmin ? (
          <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
            <div className="flex items-center justify-between text-forest-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Giá trị tồn kho</span>
              <Boxes className="w-5 h-5 text-sage-600" />
            </div>
            <div className="text-xl font-bold text-forest-900">
              {formatCurrency(totalInventoryValue)}
            </div>
            <div className="text-xs text-forest-500 mt-1">Tính theo giá vốn MWAC</div>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
            <div className="flex items-center justify-between text-forest-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Tổng tồn thực tế</span>
              <Boxes className="w-5 h-5 text-sage-600" />
            </div>
            <div className="text-2xl font-bold text-forest-900">{totalStockCount}</div>
            <div className="text-xs text-forest-500 mt-1">Tất cả sản phẩm trong tiệm</div>
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 3. TAB 1: BẢNG TỒN KHO THÀNH PHẨM          */}
      {/* ========================================== */}
      {activeTab === 'STOCK' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-sage-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
              <input
                type="text"
                placeholder="Tìm theo tên hoặc mã SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800 placeholder-forest-400"
              />
            </div>

            <div className="relative w-full sm:w-60">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 appearance-none text-forest-800"
              >
                <option value="ALL">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-cream-100 text-forest-700 font-semibold border-b border-sage-200">
                  <tr>
                    <th className="py-3.5 px-4">Sản phẩm</th>
                    <th className="py-3.5 px-4">Danh mục</th>
                    <th className="py-3.5 px-4">Phân loại</th>
                    <th className="py-3.5 px-4 text-center">Tồn thực tế</th>
                    <th className="py-3.5 px-4 text-center">Đang giữ</th>
                    <th className="py-3.5 px-4 text-center">Khả dụng</th>
                    {isAdmin && <th className="py-3.5 px-4 text-right">Giá vốn MWAC</th>}
                    {isAdmin && <th className="py-3.5 px-4 text-right">Tổng giá trị kho</th>}
                    <th className="py-3.5 px-4 text-center">Tình trạng</th>
                    {isAdmin && <th className="py-3.5 px-4 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-100 text-forest-800">
                  {isLoadingStock ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 7} className="py-12 text-center text-forest-400">
                        Đang tải dữ liệu tồn kho...
                      </td>
                    </tr>
                  ) : stockItems.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 7} className="py-12 text-center text-forest-400">
                        Chưa có sản phẩm nào trong kho.
                      </td>
                    </tr>
                  ) : (
                    stockItems.map((item) => (
                      <tr key={item.id} className="hover:bg-cream-50/70 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center text-sage-600 font-bold overflow-hidden flex-shrink-0">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Flower2 className="w-5 h-5 text-sage-600" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-forest-900 leading-tight">{item.name}</div>
                              <div className="text-xs text-forest-400 font-mono mt-0.5">{item.sku}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-medium text-forest-700">
                          {item.category.name}
                        </td>

                        <td className="py-3.5 px-4">
                          {item.type === 'FINISHED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              <Flower2 className="w-3 h-3" /> Thành phẩm
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              <Sparkles className="w-3 h-3" /> Bán TP
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center font-bold text-forest-900">
                          {formatQuantity(item.inventory.actualQuantity)}
                        </td>

                        <td className="py-3.5 px-4 text-center text-amber-700 font-medium">
                          {item.inventory.reservedQuantity > 0 ? formatQuantity(item.inventory.reservedQuantity) : '-'}
                        </td>

                        <td className="py-3.5 px-4 text-center font-bold">
                          <span
                            className={
                              item.inventory.availableQuantity > 0 ? 'text-emerald-700' : 'text-rose-600'
                            }
                          >
                            {formatQuantity(item.inventory.availableQuantity)}
                          </span>
                        </td>

                        {isAdmin && (
                          <td className="py-3.5 px-4 text-right font-medium text-forest-800">
                            {formatCurrency(item.inventory.avgCost)}
                          </td>
                        )}

                        {isAdmin && (
                          <td className="py-3.5 px-4 text-right font-bold text-forest-900">
                            {formatCurrency(item.inventory.totalInventoryValue)}
                          </td>
                        )}

                        <td className="py-3.5 px-4 text-center">
                          {item.inventory.isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" /> Sắp hết
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Đủ hàng
                            </span>
                          )}
                        </td>

                        {isAdmin && (
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleOpenAdjustModal(item)}
                              className="px-3 py-1.5 rounded-xl border border-sage-300 hover:bg-cream-100 text-forest-700 text-xs font-medium inline-flex items-center gap-1 transition"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-sage-600" />
                              Kiểm kê
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 4. TAB 2: SỔ THẺ KHO THÀNH PHẨM (LEDGER)   */}
      {/* ========================================== */}
      {activeTab === 'LEDGER' && isAdmin && (
        <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-sage-200 flex items-center justify-between bg-cream-50">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-sage-600" />
              <h3 className="font-semibold text-sm text-forest-900">
                Nhật ký biến động xuất nhập tồn kho thành phẩm
              </h3>
            </div>
            <span className="text-xs text-forest-500 font-mono">
              Hiển thị {ledgerItems.length} giao dịch gần nhất
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-cream-100 text-forest-700 font-semibold border-b border-sage-200">
                <tr>
                  <th className="py-3.5 px-4">Thời gian</th>
                  <th className="py-3.5 px-4">Mã chứng từ</th>
                  <th className="py-3.5 px-4">Loại biến động</th>
                  <th className="py-3.5 px-4">Sản phẩm</th>
                  <th className="py-3.5 px-4 text-right">Tồn trước</th>
                  <th className="py-3.5 px-4 text-right">Biến động</th>
                  <th className="py-3.5 px-4 text-right">Tồn sau</th>
                  <th className="py-3.5 px-4 text-right">Đơn giá vốn</th>
                  <th className="py-3.5 px-4 text-right">Thành tiền</th>
                  <th className="py-3.5 px-4">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-100 text-forest-800">
                {isLoadingLedger ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-forest-400">
                      Đang tải sổ thẻ kho...
                    </td>
                  </tr>
                ) : ledgerItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-forest-400">
                      Chưa có giao dịch thẻ kho thành phẩm nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  ledgerItems.map((item) => (
                    <tr key={item.id} className="hover:bg-cream-50/50">
                      <td className="py-3.5 px-4 text-forest-500">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-sage-800">
                        {item.documentCode}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.documentType === 'PRODUCTION_IMPORT' && (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                            Nhập SX
                          </span>
                        )}
                        {item.documentType === 'SALE_EXPORT' && (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                            Xuất bán
                          </span>
                        )}
                        {item.documentType === 'ADJUSTMENT_IN' && (
                          <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-semibold">
                            Kiểm kê tăng
                          </span>
                        )}
                        {item.documentType === 'ADJUSTMENT_OUT' && (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
                            Kiểm kê giảm
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-forest-900">
                        {item.product.name}
                        <div className="text-[10px] text-forest-400 font-mono">{item.product.sku}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right">{formatQuantity(item.qtyBefore)}</td>
                      <td className="py-3.5 px-4 text-right font-bold">
                        {item.documentType.includes('IMPORT') || item.documentType.includes('IN') ? (
                          <span className="text-emerald-700">+{formatQuantity(item.qtyChange)}</span>
                        ) : (
                          <span className="text-rose-600">-{formatQuantity(item.qtyChange)}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-forest-900">
                        {formatQuantity(item.qtyAfter)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-forest-700">
                        {formatCurrency(item.unitCost)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-forest-900">
                        {formatCurrency(item.totalCost)}
                      </td>
                      <td className="py-3.5 px-4 text-forest-500 max-w-xs truncate">
                        {item.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 5. MODAL KIỂM KÊ / ĐIỀU CHỈNH KHO          */}
      {/* ========================================== */}
      {isAdjustModalOpen && adjustingProduct && (
        <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-sage-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-sage-600" />
                <h3 className="font-serif font-bold text-lg text-forest-900">
                  Kiểm Kê Tồn Kho Thực Tế
                </h3>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-2 text-forest-400 hover:text-forest-700 rounded-xl hover:bg-cream-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjust} className="p-6 space-y-4">
              {adjustError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{adjustError}</span>
                </div>
              )}

              <div className="p-3 bg-cream-50 rounded-xl border border-sage-200 space-y-1">
                <div className="text-xs text-forest-500">Sản phẩm điều chỉnh:</div>
                <div className="font-semibold text-forest-900">{adjustingProduct.name}</div>
                <div className="text-xs font-mono text-forest-400">{adjustingProduct.sku}</div>
                <div className="text-xs text-forest-600 pt-1">
                  Tồn kho hiện ghi nhận trên máy:{' '}
                  <strong>{formatQuantity(adjustingProduct.inventory.actualQuantity)}</strong> cái
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Số lượng kiểm kê thực tế đếm được <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={actualQtyInput}
                  onChange={(e) => setActualQtyInput(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm font-bold text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  required
                />
              </div>

              {actualQtyInput !== adjustingProduct.inventory.actualQuantity && (
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <span className="text-forest-600">Chênh lệch điều chỉnh:</span>
                  <span
                    className={
                      actualQtyInput > adjustingProduct.inventory.actualQuantity
                        ? 'text-emerald-700 font-bold'
                        : 'text-rose-600 font-bold'
                    }
                  >
                    {actualQtyInput > adjustingProduct.inventory.actualQuantity ? '+' : ''}
                    {actualQtyInput - adjustingProduct.inventory.actualQuantity} cái
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Lý do điều chỉnh kiểm kê <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="VD: Hao hụt cánh hoa trưng bày, gãy cành, kiểm kê định kỳ..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-sage-200">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-sage-300 text-forest-700 hover:bg-cream-100 font-medium text-sm transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={adjustStockMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm transition shadow-sm disabled:opacity-50"
                >
                  {adjustStockMutation.isPending ? 'Đang lưu...' : 'Xác nhận kiểm kê'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
