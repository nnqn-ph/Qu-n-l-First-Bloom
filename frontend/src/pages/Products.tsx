import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { formatCurrency, formatQuantity } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import {
  Flower2,
  Plus,
  Search,
  Filter,
  Layers,
  Sparkles,
  Edit3,
  Trash2,
  AlertCircle,
  X,
  FileSpreadsheet,
  TrendingUp,
  Package,
} from 'lucide-react';

interface ProductCategory {
  id: string;
  code: string;
  name: string;
  _count?: { products: number };
}

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  type: 'FINISHED' | 'INTERMEDIATE';
  sellingPrice: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: string; code: string; name: string };
  inventory: {
    actualQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    avgCost?: number;
  };
  activeRecipe?: {
    id: string;
    version: number;
    name: string;
    expectedCost: number;
    itemsCount: number;
    grossMarginPercent: number;
  } | null;
}

export function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roleId === 'ADMIN';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Filters state
  const [selectedType, setSelectedType] = useState<'ALL' | 'FINISHED' | 'INTERMEDIATE'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Product Form state
  const [productForm, setProductForm] = useState({
    categoryId: '',
    sku: '',
    name: '',
    imageUrl: '',
    type: 'FINISHED' as 'FINISHED' | 'INTERMEDIATE',
    sellingPrice: 0,
    description: '',
    isActive: true,
  });

  // Category Form state
  const [newCatName, setNewCatName] = useState('');

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<ProductCategory[]>({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await api.get('/product-categories');
      return res.data.data;
    },
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<ProductItem[]>({
    queryKey: ['products', selectedCategory, selectedType, searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (selectedCategory !== 'ALL') params.categoryId = selectedCategory;
      if (selectedType !== 'ALL') params.type = selectedType;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await api.get('/products', { params });
      return res.data.data;
    },
  });

  // ==========================================
  // MUTATIONS
  // ==========================================

  const createProductMutation = useMutation({
    mutationFn: async (payload: typeof productForm) => {
      return api.post('/products', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsProductModalOpen(false);
      resetProductForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Lỗi khi tạo sản phẩm');
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: typeof productForm }) => {
      return api.patch(`/products/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsProductModalOpen(false);
      resetProductForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Lỗi khi cập nhật sản phẩm');
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Không thể xóa sản phẩm');
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (payload: { code?: string; name: string }) => {
      return api.post('/product-categories', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      setNewCatName('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Lỗi khi tạo danh mục');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/product-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Không thể xóa danh mục');
    },
  });

  // Helpers
  const resetProductForm = () => {
    setProductForm({
      categoryId: categories[0]?.id || '',
      sku: '',
      name: '',
      imageUrl: '',
      type: 'FINISHED',
      sellingPrice: 0,
      description: '',
      isActive: true,
    });
    setEditingProduct(null);
    setFormError(null);
  };

  const handleOpenCreateModal = () => {
    resetProductForm();
    if (categories.length > 0) {
      setProductForm((prev) => ({ ...prev, categoryId: categories[0].id }));
    }
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (p: ProductItem) => {
    setEditingProduct(p);
    setProductForm({
      categoryId: p.category.id,
      sku: p.sku,
      name: p.name,
      imageUrl: p.imageUrl || '',
      type: p.type,
      sellingPrice: p.sellingPrice,
      description: p.description || '',
      isActive: p.isActive,
    });
    setFormError(null);
    setIsProductModalOpen(true);
  };

  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!productForm.name.trim()) {
      setFormError('Vui lòng nhập tên sản phẩm');
      return;
    }

    const payload: any = {
      ...productForm,
      name: productForm.name.trim(),
      sku: productForm.sku.trim() || undefined,
      description: productForm.description.trim() || undefined,
      imageUrl: productForm.imageUrl.trim() || undefined,
      categoryId: productForm.categoryId || undefined,
    };

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, payload });
    } else {
      createProductMutation.mutate(payload);
    }
  };

  // Metrics
  const totalProductsCount = products.length;
  const finishedCount = products.filter((p) => p.type === 'FINISHED').length;
  const intermediateCount = products.filter((p) => p.type === 'INTERMEDIATE').length;
  const missingRecipeCount = products.filter((p) => !p.activeRecipe).length;

  return (
    <div className="space-y-6">
      {/* 1. Header & Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-sage-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-700">
            <Flower2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-forest-900">
              Quản lý Sản phẩm & Bán thành phẩm
            </h1>
            <p className="text-sm text-forest-600">
              Danh mục hoa kẽm nhung, cành hoa lẻ, giá bán và cấu trúc công thức sản xuất
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-4 py-2.5 rounded-xl border border-sage-300 text-forest-700 bg-white hover:bg-cream-100 font-medium text-sm flex items-center gap-2 transition"
            >
              <Layers className="w-4 h-4 text-sage-600" />
              Danh mục SP
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm flex items-center gap-2 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Thêm sản phẩm mới
            </button>
          </div>
        )}
      </div>

      {/* 2. Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng mặt hàng</span>
            <Package className="w-5 h-5 text-sage-600" />
          </div>
          <div className="text-2xl font-bold text-forest-900">{totalProductsCount}</div>
          <div className="text-xs text-forest-500 mt-1">Sản phẩm trong cơ sở dữ liệu</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Thành phẩm bán</span>
            <Flower2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{finishedCount}</div>
          <div className="text-xs text-forest-500 mt-1">Bó hoa, giỏ hoa, hộp quà</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Bán thành phẩm</span>
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{intermediateCount}</div>
          <div className="text-xs text-forest-500 mt-1">Cành hoa lẻ, phụ kiện uốn sẵn</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Chưa có công thức</span>
            <FileSpreadsheet className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{missingRecipeCount}</div>
          <div className="text-xs text-forest-500 mt-1">Cần cấu hình định mức BOM</div>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="bg-white p-4 rounded-2xl border border-sage-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Type Tabs */}
        <div className="flex bg-cream-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setSelectedType('ALL')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              selectedType === 'ALL'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-forest-600 hover:text-forest-900'
            }`}
          >
            Tất cả ({totalProductsCount})
          </button>
          <button
            onClick={() => setSelectedType('FINISHED')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              selectedType === 'FINISHED'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-forest-600 hover:text-forest-900'
            }`}
          >
            Thành phẩm ({finishedCount})
          </button>
          <button
            onClick={() => setSelectedType('INTERMEDIATE')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              selectedType === 'INTERMEDIATE'
                ? 'bg-white text-forest-900 shadow-sm'
                : 'text-forest-600 hover:text-forest-900'
            }`}
          >
            Bán thành phẩm ({intermediateCount})
          </button>
        </div>

        {/* Category & Search Input */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-48">
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

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800 placeholder-forest-400"
            />
          </div>
        </div>
      </div>

      {/* 4. Products Table */}
      <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream-100 text-forest-700 font-semibold border-b border-sage-200">
              <tr>
                <th className="py-3.5 px-4">Sản phẩm</th>
                <th className="py-3.5 px-4">Danh mục</th>
                <th className="py-3.5 px-4">Loại SP</th>
                <th className="py-3.5 px-4 text-right">Giá bán niêm yết</th>
                <th className="py-3.5 px-4 text-center">Tồn kho</th>
                {isAdmin && <th className="py-3.5 px-4 text-right">Giá vốn ước tính (BOM)</th>}
                {isAdmin && <th className="py-3.5 px-4 text-right">Lãi gộp dự tính</th>}
                <th className="py-3.5 px-4 text-center">Trạng thái</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage-100 text-forest-800">
              {isLoadingProducts || isLoadingCategories ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 7} className="py-12 text-center text-forest-400">
                    Đang tải danh sách sản phẩm...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 7} className="py-12 text-center text-forest-400">
                    Chưa có sản phẩm nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-cream-50/70 transition">
                      {/* Product Name & SKU */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center text-sage-600 font-bold overflow-hidden flex-shrink-0">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <Flower2 className="w-5 h-5 text-sage-600" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-forest-900 leading-tight">{p.name}</div>
                            <div className="text-xs text-forest-400 font-mono mt-0.5">{p.sku}</div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-1 bg-sage-100 text-sage-800 rounded-lg text-xs font-medium">
                          {p.category.name}
                        </span>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        {p.type === 'FINISHED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            <Flower2 className="w-3 h-3" /> Thành phẩm
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            <Sparkles className="w-3 h-3" /> Bán thành phẩm
                          </span>
                        )}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3.5 px-4 text-right font-medium text-forest-900">
                        {formatCurrency(p.sellingPrice)}
                      </td>

                      {/* Inventory Count */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`font-semibold ${
                              p.inventory.availableQuantity > 0 ? 'text-forest-900' : 'text-rose-600'
                            }`}
                          >
                            {formatQuantity(p.inventory.availableQuantity)}
                          </span>
                          {p.inventory.reservedQuantity > 0 && (
                            <span className="text-[10px] text-amber-700">
                              (Giữ: {p.inventory.reservedQuantity})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Expected Cost (Admin) */}
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          {p.activeRecipe ? (
                            <div>
                              <div className="font-semibold text-forest-800">
                                {formatCurrency(p.activeRecipe.expectedCost)}
                              </div>
                              <div className="text-[10px] text-forest-400">
                                {p.activeRecipe.name} (v{p.activeRecipe.version})
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-rose-500 italic">Chưa có BOM</span>
                          )}
                        </td>
                      )}

                      {/* Gross Margin % (Admin) */}
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          {p.activeRecipe && p.activeRecipe.expectedCost > 0 ? (
                            <div className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <TrendingUp className="w-3.5 h-3.5" />
                              {p.activeRecipe.grossMarginPercent}%
                            </div>
                          ) : (
                            <span className="text-xs text-forest-400">-</span>
                          )}
                        </td>
                      )}

                      {/* Active Status */}
                      <td className="py-3.5 px-4 text-center">
                        {p.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Đang bán
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                            Ngừng bán
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && (
                            <button
                              onClick={() => navigate(`/recipes?productId=${p.id}`)}
                              title="Xem/Lập công thức BOM"
                              className="p-1.5 rounded-lg text-sage-600 hover:bg-sage-100 transition"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              title="Chỉnh sửa sản phẩm"
                              className="p-1.5 rounded-lg text-forest-600 hover:bg-cream-200 transition"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Bạn có chắc chắn muốn xóa sản phẩm '${p.name}' (${p.sku})?`
                                  )
                                ) {
                                  deleteProductMutation.mutate(p.id);
                                }
                              }}
                              title="Xóa sản phẩm"
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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
      {/* 5. MODAL THÊM / SỬA SẢN PHẨM               */}
      {/* ========================================== */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-sage-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Flower2 className="w-5 h-5 text-sage-600" />
                <h3 className="font-serif font-bold text-lg text-forest-900">
                  {editingProduct ? 'Chỉnh sửa Sản phẩm' : 'Thêm Sản phẩm Mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-2 text-forest-400 hover:text-forest-700 rounded-xl hover:bg-cream-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Category & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Danh mục sản phẩm
                  </label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                  >
                    <option value="">
                      {categories.length > 0 ? '-- Chọn danh mục (hoặc để mặc định) --' : '-- Mặc định (Hoa thành phẩm) --'}
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Loại sản phẩm <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={productForm.type}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        type: e.target.value as 'FINISHED' | 'INTERMEDIATE',
                      })
                    }
                    className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                  >
                    <option value="FINISHED">Thành phẩm hoàn chỉnh (Bó/Giỏ hoa)</option>
                    <option value="INTERMEDIATE">Bán thành phẩm (Cành hoa rời, Lá uốn sẵn)</option>
                  </select>
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Tên sản phẩm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Bó hoa Tulip 5 bông kem đỏ"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800 font-medium"
                  required
                />
              </div>

              {/* Optional SKU if editing */}
              {editingProduct && (
                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Mã sản phẩm (SKU)
                  </label>
                  <input
                    type="text"
                    value={productForm.sku}
                    onChange={(e) =>
                      setProductForm({ ...productForm, sku: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm font-mono text-forest-600"
                  />
                </div>
              )}

              {/* Selling Price & Image URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Giá bán niêm yết (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={productForm.sellingPrice}
                    onChange={(e) =>
                      setProductForm({ ...productForm, sellingPrice: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800 font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Link ảnh sản phẩm (tùy chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={productForm.imageUrl}
                    onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Mô tả sản phẩm / Thành phần hoa
                </label>
                <textarea
                  rows={3}
                  placeholder="Ghi chú về kiểu dáng, số cành hoa, loại giấy gói..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={productForm.isActive}
                  onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-sage-600 rounded focus:ring-sage-500"
                />
                <label htmlFor="isActiveToggle" className="text-sm text-forest-800 cursor-pointer">
                  Kích hoạt kinh doanh (Hiển thị cho nhân viên bán hàng)
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-sage-200">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-sage-300 text-forest-700 hover:bg-cream-100 font-medium text-sm transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createProductMutation.isPending || updateProductMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm transition shadow-sm disabled:opacity-50"
                >
                  {createProductMutation.isPending || updateProductMutation.isPending
                    ? 'Đang lưu...'
                    : editingProduct
                    ? 'Lưu thay đổi'
                    : 'Tạo sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 6. MODAL QUẢN LÝ DANH MỤC SẢN PHẨM        */}
      {/* ========================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-sage-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-sage-600" />
                <h3 className="font-serif font-bold text-lg text-forest-900">
                  Quản lý Danh mục Sản phẩm
                </h3>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-2 text-forest-400 hover:text-forest-700 rounded-xl hover:bg-cream-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Add category form */}
              <div className="p-4 bg-cream-50 rounded-2xl border border-sage-200 space-y-3">
                <div className="text-xs font-semibold uppercase text-forest-700">
                  Thêm danh mục mới
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nhập tên danh mục (VD: Giỏ hoa, Hoa cưới, Bó hoa...)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newCatName.trim()) {
                        alert('Vui lòng nhập tên danh mục');
                        return;
                      }
                      createCategoryMutation.mutate({ name: newCatName.trim() });
                    }}
                    disabled={createCategoryMutation.isPending}
                    className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-sm font-medium transition shadow-sm whitespace-nowrap"
                  >
                    {createCategoryMutation.isPending ? 'Đang thêm...' : '+ Thêm danh mục'}
                  </button>
                </div>
              </div>

              {/* Category list */}
              <div className="divide-y divide-sage-100 max-h-60 overflow-y-auto">
                {categories.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-forest-900">{c.name}</div>
                      <div className="text-xs text-forest-400 font-mono">
                        {c.code} • {c._count?.products || 0} sản phẩm
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm(`Bạn muốn xóa danh mục '${c.name}'?`)) {
                          deleteCategoryMutation.mutate(c.id);
                        }
                      }}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                      title="Xóa danh mục"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
