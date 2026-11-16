import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { formatCurrency, formatQuantity, formatDateTime } from '../utils/format';
import {
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Flower2,
  Boxes,
  Trash2,
  TrendingUp,
  X,
  AlertCircle,
} from 'lucide-react';

interface RecipeListItem {
  id: string;
  productId: string;
  version: number;
  name: string;
  isActive: boolean;
  expectedCost: number;
  notes: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string; username: string };
  product: {
    id: string;
    sku: string;
    name: string;
    type: 'FINISHED' | 'INTERMEDIATE';
    sellingPrice: number;
    category: { id: string; name: string };
  };
  itemsCount: number;
  productionOrdersCount: number;
  grossMarginPercent: number;
}

interface RecipeDetailItem {
  id: string;
  itemType: 'MATERIAL' | 'SUB_PRODUCT';
  materialId?: string;
  subProductId?: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  lossRate: number;
  effectiveQuantity: number;
  snapshotCost: number;
  currentLiveUnitCost: number;
  currentLiveLineCost: number;
}

interface RecipeDetail {
  id: string;
  productId: string;
  version: number;
  name: string;
  isActive: boolean;
  expectedCost: number;
  currentLiveTotalCost: number;
  costDifference: number;
  grossMarginPercent: number;
  grossProfit: number;
  notes: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string; username: string };
  product: {
    id: string;
    sku: string;
    name: string;
    type: 'FINISHED' | 'INTERMEDIATE';
    sellingPrice: number;
    category: { id: string; name: string };
  };
  items: RecipeDetailItem[];
}

interface RawMaterialOption {
  id: string;
  sku: string;
  name: string;
  unit: string;
  inventory: { avgCost: number; quantity: number };
}

export function RecipesPage() {
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get('productId') || '';
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Recipe Builder Form State
  const [builderProductId, setBuilderProductId] = useState<string>('');
  const [builderRecipeName, setBuilderRecipeName] = useState<string>('');
  const [builderNotes, setBuilderNotes] = useState<string>('');
  const [builderItems, setBuilderItems] = useState<
    Array<{
      itemType: 'MATERIAL' | 'SUB_PRODUCT';
      materialId?: string;
      subProductId?: string;
      quantity: number;
      lossRate: number;
    }>
  >([]);

  // ==========================================
  // 1. DATA QUERIES
  // ==========================================

  const { data: recipes = [], isLoading: isLoadingRecipes } = useQuery<RecipeListItem[]>({
    queryKey: ['recipes', selectedProductId, searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (selectedProductId) params.productId = selectedProductId;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await api.get('/recipes', { params });
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

  const { data: materials = [] } = useQuery<RawMaterialOption[]>({
    queryKey: ['materials'],
    queryFn: async () => {
      const res = await api.get('/materials');
      return res.data.data;
    },
  });

  // Selected Recipe Details Query
  const { data: recipeDetail, isLoading: isLoadingDetail } = useQuery<RecipeDetail>({
    queryKey: ['recipe-detail', selectedRecipeId],
    queryFn: async () => {
      if (!selectedRecipeId) return null as any;
      const res = await api.get(`/recipes/${selectedRecipeId}`);
      return res.data.data;
    },
    enabled: !!selectedRecipeId,
  });

  // Automatically select first recipe when list loads
  useEffect(() => {
    if (recipes.length > 0 && !selectedRecipeId) {
      setSelectedRecipeId(recipes[0].id);
    }
  }, [recipes, selectedRecipeId]);

  // ==========================================
  // 2. LIVE SIMULATION MUTATION
  // ==========================================

  const { data: simulationResult } = useQuery({
    queryKey: ['simulate-recipe', builderProductId, builderItems],
    queryFn: async () => {
      if (builderItems.length === 0) return null;
      // Filter out incomplete rows
      const validItems = builderItems.filter((it) =>
        it.itemType === 'MATERIAL' ? !!it.materialId && it.quantity > 0 : !!it.subProductId && it.quantity > 0
      );
      if (validItems.length === 0) return null;

      try {
        const res = await api.post('/recipes/simulate-cost', {
          productId: builderProductId || undefined,
          items: validItems,
        });
        return res.data.data;
      } catch (e) {
        return null;
      }
    },
    enabled: isCreateModalOpen && builderItems.length > 0,
  });

  // ==========================================
  // 3. MUTATIONS
  // ==========================================

  const createRecipeMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post('/recipes', payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsCreateModalOpen(false);
      setSelectedRecipeId(res.data.data.id);
      resetBuilderForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Lỗi khi lưu công thức');
    },
  });

  const setActiveRecipeMutation = useMutation({
    mutationFn: async ({ productId, recipeId }: { productId: string; recipeId: string }) => {
      return api.patch(`/products/${productId}/recipes/${recipeId}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-detail'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Lỗi khi kích hoạt công thức');
    },
  });

  // Builder Helpers
  const resetBuilderForm = () => {
    setBuilderProductId(products[0]?.id || '');
    setBuilderRecipeName('');
    setBuilderNotes('');
    setBuilderItems([
      {
        itemType: 'MATERIAL',
        materialId: materials[0]?.id || '',
        quantity: 1,
        lossRate: 0,
      },
    ]);
    setFormError(null);
  };

  const handleOpenBuilder = (presetProdId?: string) => {
    resetBuilderForm();
    if (presetProdId) {
      setBuilderProductId(presetProdId);
      const prod = products.find((p) => p.id === presetProdId);
      if (prod) {
        setBuilderRecipeName(`Công thức chuẩn: ${prod.name}`);
      }
    } else if (products.length > 0) {
      setBuilderProductId(products[0].id);
      setBuilderRecipeName(`Công thức chuẩn: ${products[0].name}`);
    }
    setIsCreateModalOpen(true);
  };

  const handleAddItemRow = (type: 'MATERIAL' | 'SUB_PRODUCT') => {
    if (type === 'MATERIAL') {
      setBuilderItems((prev) => [
        ...prev,
        {
          itemType: 'MATERIAL',
          materialId: materials[0]?.id || '',
          quantity: 1,
          lossRate: 0,
        },
      ]);
    } else {
      // Find intermediate products different from current product to avoid immediate self-cycle
      const subProd = products.find(
        (p) => p.type === 'INTERMEDIATE' && p.id !== builderProductId
      );
      setBuilderItems((prev) => [
        ...prev,
        {
          itemType: 'SUB_PRODUCT',
          subProductId: subProd?.id || '',
          quantity: 1,
          lossRate: 0,
        },
      ]);
    }
  };

  const handleRemoveItemRow = (index: number) => {
    setBuilderItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemFieldChange = (index: number, field: string, value: any) => {
    setBuilderItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmitRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!builderProductId) {
      setFormError('Vui lòng chọn sản phẩm');
      return;
    }
    if (!builderRecipeName.trim()) {
      setFormError('Vui lòng nhập tên công thức định mức');
      return;
    }
    if (builderItems.length === 0) {
      setFormError('Công thức phải có ít nhất 1 thành phần nguyên vật liệu hoặc bán thành phẩm');
      return;
    }

    // Validate cycle on frontend
    const hasSelfSubProduct = builderItems.some(
      (it) => it.itemType === 'SUB_PRODUCT' && it.subProductId === builderProductId
    );
    if (hasSelfSubProduct) {
      setFormError('Không thể thêm chính sản phẩm này làm bán thành phẩm của chính nó!');
      return;
    }

    createRecipeMutation.mutate({
      productId: builderProductId,
      name: builderRecipeName.trim(),
      notes: builderNotes.trim() || undefined,
      isActive: true,
      items: builderItems,
    });
  };

  // Metrics
  const totalRecipesCount = recipes.length;
  const productsWithRecipeCount = new Set(recipes.map((r) => r.productId)).size;

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-sage-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-700">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-forest-900">
              Công thức Sản xuất & Định mức (BOM)
            </h1>
            <p className="text-sm text-forest-600">
              Cấu trúc cây sản phẩm đa cấp, tính giá vốn tự động từ kho và kiểm soát hao hụt
            </p>
          </div>
        </div>

        <button
          onClick={() => handleOpenBuilder()}
          className="px-4 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Thiết lập công thức BOM mới
        </button>
      </div>

      {/* 2. Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng số công thức</span>
            <FileSpreadsheet className="w-5 h-5 text-sage-600" />
          </div>
          <div className="text-2xl font-bold text-forest-900">{totalRecipesCount}</div>
          <div className="text-xs text-forest-500 mt-1">Bao gồm cả các phiên bản (version)</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sản phẩm đã có BOM</span>
            <Flower2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{productsWithRecipeCount}</div>
          <div className="text-xs text-forest-500 mt-1">Sẵn sàng để đưa vào lệnh sản xuất</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Đặc tính công nghệ</span>
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-sm font-semibold text-forest-800">Cây định mức đa cấp</div>
          <div className="text-xs text-forest-500 mt-1">Tự động phát hiện chu trình lặp (DFS)</div>
        </div>
      </div>

      {/* 3. Main Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Recipes List (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-sage-200 shadow-sm space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
              <input
                type="text"
                placeholder="Tìm công thức hoặc sản phẩm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800 placeholder-forest-400"
              />
            </div>

            {/* Product Filter */}
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
            >
              <option value="">Tất cả sản phẩm</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recipes Card List */}
          <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
            {isLoadingRecipes ? (
              <div className="p-8 text-center text-forest-400 bg-white rounded-2xl border border-sage-200">
                Đang tải công thức...
              </div>
            ) : recipes.length === 0 ? (
              <div className="p-8 text-center text-forest-400 bg-white rounded-2xl border border-sage-200">
                Chưa có công thức BOM nào phù hợp.
              </div>
            ) : (
              recipes.map((r) => {
                const isSelected = selectedRecipeId === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRecipeId(r.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? 'bg-sage-50 border-sage-500 shadow-sm ring-1 ring-sage-500'
                        : 'bg-white border-sage-200 hover:border-sage-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-forest-900 text-sm leading-tight">
                          {r.name}
                        </div>
                        <div className="text-xs text-forest-500 font-mono mt-0.5">
                          {r.product.sku} • {r.product.name}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] font-mono px-2 py-0.5 bg-cream-200 text-forest-800 rounded-md">
                          v{r.version}
                        </span>
                        {r.isActive && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Chuẩn
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-sage-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-forest-500">Giá vốn BOM: </span>
                        <span className="font-bold text-forest-900">
                          {formatCurrency(r.expectedCost)}
                        </span>
                      </div>
                      <div className="text-emerald-700 font-medium">
                        Lãi: {r.grossMarginPercent}%
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Recipe Detail Inspector (8 cols) */}
        <div className="lg:col-span-8">
          {isLoadingDetail ? (
            <div className="p-12 text-center text-forest-400 bg-white rounded-3xl border border-sage-200">
              Đang tải chi tiết định mức BOM...
            </div>
          ) : !recipeDetail ? (
            <div className="p-12 text-center text-forest-400 bg-white rounded-3xl border border-sage-200">
              Vui lòng chọn một công thức ở danh sách bên trái để xem chi tiết.
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-sage-200 shadow-sm p-6 space-y-6">
              {/* Product Header in Inspector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-sage-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-serif font-bold text-forest-900">
                      {recipeDetail.name}
                    </h2>
                    <span className="text-xs font-mono px-2.5 py-0.5 bg-cream-200 text-forest-800 rounded-md font-bold">
                      v{recipeDetail.version}
                    </span>
                    {recipeDetail.isActive && (
                      <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Công thức chuẩn
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-forest-500 mt-1">
                    Sản phẩm: <span className="font-semibold text-forest-800">{recipeDetail.product.name}</span> ({recipeDetail.product.sku}) • Lập bởi {recipeDetail.createdBy.fullName} lúc {formatDateTime(recipeDetail.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!recipeDetail.isActive && (
                    <button
                      onClick={() =>
                        setActiveRecipeMutation.mutate({
                          productId: recipeDetail.productId,
                          recipeId: recipeDetail.id,
                        })
                      }
                      className="px-3.5 py-2 rounded-xl bg-cream-100 hover:bg-cream-200 text-forest-800 text-xs font-semibold transition"
                    >
                      Kích hoạt làm bản chuẩn
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenBuilder(recipeDetail.productId)}
                    className="px-3.5 py-2 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold transition shadow-sm"
                  >
                    + Tạo phiên bản mới (v{recipeDetail.version + 1})
                  </button>
                </div>
              </div>

              {/* Cost Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-cream-50 p-4 rounded-2xl border border-sage-200">
                <div>
                  <div className="text-xs text-forest-500">Giá bán niêm yết</div>
                  <div className="text-lg font-bold text-forest-900">
                    {formatCurrency(recipeDetail.product.sellingPrice)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-forest-500">Giá vốn định mức (BOM)</div>
                  <div className="text-lg font-bold text-forest-900">
                    {formatCurrency(recipeDetail.expectedCost)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-forest-500">Lợi nhuận gộp dự tính</div>
                  <div className="text-lg font-bold text-emerald-700">
                    {formatCurrency(recipeDetail.grossProfit)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-forest-500">Tỷ suất lãi gộp</div>
                  <div className="text-lg font-bold text-emerald-700 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    {recipeDetail.grossMarginPercent}%
                  </div>
                </div>
              </div>

              {/* Warning if current live cost differs from snapshot */}
              {Math.abs(recipeDetail.costDifference) > 100 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      Giá vốn nguyên vật liệu trong kho hiện tại là{' '}
                      <strong>{formatCurrency(recipeDetail.currentLiveTotalCost)}</strong> (chênh lệch{' '}
                      <strong>{formatCurrency(recipeDetail.costDifference)}</strong> so với thời điểm lập BOM).
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenBuilder(recipeDetail.productId)}
                    className="underline font-semibold hover:text-amber-900 ml-2"
                  >
                    Tạo phiên bản mới
                  </button>
                </div>
              )}

              {/* BOM Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-forest-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-sage-600" />
                    Cây định mức thành phần ({recipeDetail.items.length} thành phần)
                  </h3>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-sage-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-cream-100 text-forest-700 font-semibold border-b border-sage-200">
                      <tr>
                        <th className="py-3 px-3">Loại</th>
                        <th className="py-3 px-3">Mã SKU & Tên thành phần</th>
                        <th className="py-3 px-3 text-right">Định mức</th>
                        <th className="py-3 px-3 text-right">Hao hụt (%)</th>
                        <th className="py-3 px-3 text-right">Thực tính</th>
                        <th className="py-3 px-3 text-right">Đơn giá vốn</th>
                        <th className="py-3 px-3 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sage-100 text-forest-800">
                      {recipeDetail.items.map((it) => (
                        <tr key={it.id} className="hover:bg-cream-50/50">
                          <td className="py-3 px-3">
                            {it.itemType === 'MATERIAL' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sage-100 text-sage-800 text-[11px] font-medium">
                                <Boxes className="w-3 h-3" /> Nguyên liệu
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-medium">
                                <Sparkles className="w-3 h-3" /> Bán thành phẩm
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-forest-900">{it.name}</div>
                            <div className="text-[10px] text-forest-400 font-mono">{it.sku}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-medium">
                            {formatQuantity(it.quantity)} {it.unit}
                          </td>
                          <td className="py-3 px-3 text-right text-forest-600">
                            {it.lossRate}%
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-forest-900">
                            {formatQuantity(it.effectiveQuantity)}
                          </td>
                          <td className="py-3 px-3 text-right text-forest-700">
                            {formatCurrency(it.currentLiveUnitCost)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-forest-900">
                            {formatCurrency(it.currentLiveLineCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-cream-100 border-t border-sage-200 font-bold text-forest-900">
                      <tr>
                        <td colSpan={6} className="py-3 px-3 text-right">
                          TỔNG GIÁ VỐN ƯỚC TÍNH (BOM COST):
                        </td>
                        <td className="py-3 px-3 text-right text-sm text-sage-800">
                          {formatCurrency(recipeDetail.currentLiveTotalCost)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {recipeDetail.notes && (
                <div className="p-3 bg-cream-50 rounded-xl border border-sage-200 text-xs text-forest-700">
                  <span className="font-semibold text-forest-900">Ghi chú kỹ thuật: </span>
                  {recipeDetail.notes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* 4. MODAL THIẾT LẬP CÔNG THỨC BOM (BUILDER) */}
      {/* ========================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="p-6 border-b border-sage-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-sage-600" />
                <h3 className="font-serif font-bold text-lg text-forest-900">
                  Thiết lập Công thức Định mức (BOM Builder)
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-forest-400 hover:text-forest-700 rounded-xl hover:bg-cream-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRecipe} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Product Select & Recipe Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Sản phẩm áp dụng định mức <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={builderProductId}
                    onChange={(e) => {
                      setBuilderProductId(e.target.value);
                      const prod = products.find((p) => p.id === e.target.value);
                      if (prod && !builderRecipeName) {
                        setBuilderRecipeName(`Công thức chuẩn: ${prod.name}`);
                      }
                    }}
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
                    Tên công thức định mức <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Công thức chuẩn bó 5 bông tulip"
                    value={builderRecipeName}
                    onChange={(e) => setBuilderRecipeName(e.target.value)}
                    className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Ghi chú kỹ thuật / Quy cách uốn hoa
                </label>
                <input
                  type="text"
                  placeholder="Ghi chú quy cách uốn cánh hoa, quấn băng sáp hoặc gói nơ..."
                  value={builderNotes}
                  onChange={(e) => setBuilderNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                />
              </div>

              {/* Dynamic Items Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-forest-700 uppercase tracking-wider">
                    Thành phần nguyên vật liệu & bán thành phẩm
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddItemRow('MATERIAL')}
                      className="px-3 py-1 bg-sage-100 hover:bg-sage-200 text-sage-800 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Nguyên vật liệu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddItemRow('SUB_PRODUCT')}
                      className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Bán thành phẩm
                    </button>
                  </div>
                </div>

                {/* Items Rows */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {builderItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-cream-50 rounded-2xl border border-sage-200 flex flex-col sm:flex-row items-center gap-3 text-xs"
                    >
                      {/* Badge Type */}
                      <div className="w-24 flex-shrink-0">
                        {item.itemType === 'MATERIAL' ? (
                          <span className="px-2 py-1 rounded bg-sage-100 text-sage-800 font-semibold block text-center">
                            Nguyên liệu
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-amber-100 text-amber-800 font-semibold block text-center">
                            Bán thành phẩm
                          </span>
                        )}
                      </div>

                      {/* Select item */}
                      <div className="flex-1 w-full sm:w-auto">
                        {item.itemType === 'MATERIAL' ? (
                          <select
                            value={item.materialId}
                            onChange={(e) => handleItemFieldChange(idx, 'materialId', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-sage-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                            required
                          >
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                [{m.sku}] {m.name} ({m.unit}) - Vốn kho: {formatCurrency(m.inventory?.avgCost || 0)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={item.subProductId}
                            onChange={(e) => handleItemFieldChange(idx, 'subProductId', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-sage-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                            required
                          >
                            <option value="" disabled>
                              Chọn bán thành phẩm
                            </option>
                            {products
                              .filter((p) => p.type === 'INTERMEDIATE' && p.id !== builderProductId)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  [{p.sku}] {p.name} - Giá bán: {formatCurrency(p.sellingPrice)}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="w-24">
                        <label className="text-[10px] text-forest-500 block">Số lượng</label>
                        <input
                          type="number"
                          min="0.0001"
                          step="any"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemFieldChange(idx, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1 bg-white border border-sage-300 rounded-xl text-xs text-right font-semibold"
                          required
                        />
                      </div>

                      {/* Loss rate */}
                      <div className="w-20">
                        <label className="text-[10px] text-forest-500 block">Hao hụt %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={item.lossRate}
                          onChange={(e) =>
                            handleItemFieldChange(idx, 'lossRate', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1 bg-white border border-sage-300 rounded-xl text-xs text-right"
                        />
                      </div>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                        title="Xóa dòng"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Simulation Preview Box */}
              {simulationResult && (
                <div className="p-4 bg-sage-50 border border-sage-300 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-sage-900 border-b border-sage-200 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-sage-600" />
                      Mô phỏng Giá vốn & Lợi nhuận tức thời (Live Simulation)
                    </span>
                    <span className="text-emerald-700 font-bold">
                      Tỷ suất lãi: {simulationResult.grossMarginPercent}%
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-forest-500">Giá vốn ước tính:</span>
                      <div className="font-bold text-forest-900 text-sm">
                        {formatCurrency(simulationResult.totalExpectedCost)}
                      </div>
                    </div>
                    <div>
                      <span className="text-forest-500">Giá bán sản phẩm:</span>
                      <div className="font-bold text-forest-900 text-sm">
                        {formatCurrency(simulationResult.sellingPrice)}
                      </div>
                    </div>
                    <div>
                      <span className="text-forest-500">Lãi gộp ước tính:</span>
                      <div className="font-bold text-emerald-700 text-sm">
                        {formatCurrency(simulationResult.grossProfit)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
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
                  disabled={createRecipeMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm transition shadow-sm disabled:opacity-50"
                >
                  {createRecipeMutation.isPending ? 'Đang lưu...' : 'Lưu công thức định mức'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
