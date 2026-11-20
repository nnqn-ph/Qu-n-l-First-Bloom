import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatCurrency, formatDateTime, formatQuantity } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import { 
  Truck, 
  Boxes, 
  Users, 
  History, 
  Plus, 
  Search, 
  AlertTriangle, 
  Building2, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  X, 
  AlertCircle, 
  ClipboardList,
  Eye
} from 'lucide-react';

interface MaterialItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  defaultPrice: number;
  minStockAlert: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  category: { id: string; code: string; name: string };
  inventory: {
    quantity: number;
    avgCost: number;
    totalInventoryValue: number;
    isLowStock: boolean;
  };
}

interface CategoryItem {
  id: string;
  code: string;
  name: string;
  _count: { materials: number };
}

interface SupplierItem {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  totalReceiptsCount: number;
  totalPurchasedAmount: number;
}

interface PurchaseReceiptItem {
  id: string;
  code: string;
  receiptDate: string;
  totalAmount: number;
  status: string;
  notes: string | null;
  supplier: { id: string; code: string; name: string; phone: string | null };
  createdBy: { id: string; fullName: string; username: string };
  itemsCount: number;
}

interface LedgerItem {
  id: string;
  documentCode: string;
  documentType: string;
  referenceType: string;
  createdAt: string;
  issuedBy: { fullName: string; username: string };
  material: { sku: string; name: string; unit: string };
  qtyBefore: number;
  qtyChange: number;
  qtyAfter: number;
  unitCost: number;
  totalCost: number;
  notes: string | null;
}

export const MaterialsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.roleId === 'ADMIN';

  // Tabs: 'materials' | 'purchases' | 'suppliers' | 'ledger'
  const [activeTab, setActiveTab] = useState<'materials' | 'purchases' | 'suppliers' | 'ledger'>('materials');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals state
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialItem | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  // Form states - Material
  const [matSku, setMatSku] = useState('');
  const [matName, setMatName] = useState('');
  const [matCategoryId, setMatCategoryId] = useState('');
  const [matUnit, setMatUnit] = useState('bó');
  const [matDefaultPrice, setMatDefaultPrice] = useState(0);
  const [matMinStockAlert, setMatMinStockAlert] = useState(5);
  const [matNotes, setMatNotes] = useState('');
  const [matError, setMatError] = useState<string | null>(null);

  // Form states - Category
  const [catName, setCatName] = useState('');
  const [catError, setCatError] = useState<string | null>(null);

  // Form states - Supplier
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supNotes, setSupNotes] = useState('');
  const [supError, setSupError] = useState<string | null>(null);

  // Form states - Purchase Receipt
  const [receiptSupplierId, setReceiptSupplierId] = useState('');
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptLines, setReceiptLines] = useState<Array<{ materialId: string; quantity: number; unitPrice: number }>>([
    { materialId: '', quantity: 1, unitPrice: 0 },
  ]);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  // Form states - Adjust Stock
  const [adjustMaterialId, setAdjustMaterialId] = useState('');
  const [adjustActualQty, setAdjustActualQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // ==========================================
  // QUERIES
  // ==========================================

  // 1. Materials List
  const { data: materials = [], isLoading: isLoadingMaterials } = useQuery<MaterialItem[]>({
    queryKey: ['materials', selectedCategory, searchTerm, lowStockOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (searchTerm) params.append('search', searchTerm);
      if (lowStockOnly) params.append('lowStockOnly', 'true');
      const res = await api.get(`/v1/materials?${params.toString()}`);
      return res.data.data;
    },
  });

  // 2. Categories List
  const { data: categories = [] } = useQuery<CategoryItem[]>({
    queryKey: ['material-categories'],
    queryFn: async () => {
      const res = await api.get('/v1/material-categories');
      return res.data.data;
    },
  });

  // 3. Suppliers List
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery<SupplierItem[]>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await api.get('/v1/suppliers');
      return res.data.data;
    },
    enabled: isAdmin,
  });

  // 4. Purchase Receipts List
  const { data: purchaseReceipts = [], isLoading: isLoadingReceipts } = useQuery<PurchaseReceiptItem[]>({
    queryKey: ['purchase-receipts'],
    queryFn: async () => {
      const res = await api.get('/v1/purchase-receipts');
      return res.data.data;
    },
    enabled: isAdmin,
  });

  // 5. Stock Ledger
  const { data: stockLedger = [], isLoading: isLoadingLedger } = useQuery<LedgerItem[]>({
    queryKey: ['material-ledger'],
    queryFn: async () => {
      const res = await api.get('/v1/inventory/materials/ledger');
      return res.data.data;
    },
    enabled: isAdmin,
  });

  // 6. Single Receipt Detail Query
  const { data: receiptDetail } = useQuery({
    queryKey: ['purchase-receipt', selectedReceiptId],
    queryFn: async () => {
      if (!selectedReceiptId) return null;
      const res = await api.get(`/v1/purchase-receipts/${selectedReceiptId}`);
      return res.data.data;
    },
    enabled: !!selectedReceiptId,
  });

  // ==========================================
  // KPI CALCULATIONS
  // ==========================================
  const totalMaterialTypes = materials.length;
  const totalInventoryValue = materials.reduce((sum, m) => sum + m.inventory.totalInventoryValue, 0);
  const lowStockCount = materials.filter((m) => m.inventory.isLowStock).length;

  // ==========================================
  // MUTATIONS
  // ==========================================

  // Material Create / Update
  const saveMaterialMutation = useMutation({
    mutationFn: async () => {
      if (editingMaterial) {
        const res = await api.put(`/v1/materials/${editingMaterial.id}`, {
          name: matName.trim(),
          categoryId: matCategoryId || undefined,
          unit: matUnit.trim(),
          defaultPrice: Number(matDefaultPrice),
          minStockAlert: Number(matMinStockAlert),
          notes: matNotes?.trim() || undefined,
        });
        return res.data;
      } else {
        const payload: any = {
          name: matName.trim(),
          unit: matUnit.trim(),
          defaultPrice: Number(matDefaultPrice),
          minStockAlert: Number(matMinStockAlert),
        };
        if (matSku.trim()) payload.sku = matSku.trim();
        if (matCategoryId) payload.categoryId = matCategoryId;
        if (matNotes.trim()) payload.notes = matNotes.trim();
        const res = await api.post('/v1/materials', payload);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setMaterialModalOpen(false);
      resetMaterialForm();
    },
    onError: (err: any) => {
      setMatError(err.response?.data?.message || 'Lỗi khi lưu nguyên vật liệu');
    },
  });

  // Delete Material
  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/v1/materials/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Lỗi khi xóa nguyên vật liệu');
    },
  });

  // Category Create
  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/v1/material-categories', { name: catName.trim() });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-categories'] });
      setCatName('');
      setCatError(null);
    },
    onError: (err: any) => {
      setCatError(err.response?.data?.message || 'Lỗi tạo danh mục');
    },
  });

  // Supplier Create
  const createSupplierMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: supName.trim(),
      };
      if (supPhone.trim()) payload.phone = supPhone.trim();
      if (supAddress.trim()) payload.address = supAddress.trim();
      if (supNotes.trim()) payload.notes = supNotes.trim();
      const res = await api.post('/v1/suppliers', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setSupplierModalOpen(false);
      setSupName('');
      setSupPhone('');
      setSupAddress('');
      setSupNotes('');
      setSupError(null);
    },
    onError: (err: any) => {
      setSupError(err.response?.data?.message || 'Lỗi tạo nhà cung cấp');
    },
  });

  // Purchase Receipt Create
  const createPurchaseReceiptMutation = useMutation({
    mutationFn: async () => {
      const validItems = receiptLines
        .filter((l) => l.materialId && l.quantity > 0)
        .map((l) => ({
          materialId: l.materialId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
        }));

      if (validItems.length === 0) {
        throw new Error('Vui lòng chọn ít nhất 1 nguyên vật liệu và nhập số lượng lớn hơn 0');
      }

      const res = await api.post('/v1/purchase-receipts', {
        supplierId: receiptSupplierId,
        paymentMethod: receiptPaymentMethod,
        notes: receiptNotes,
        items: validItems,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['material-ledger'] });
      setPurchaseModalOpen(false);
      resetPurchaseForm();
    },
    onError: (err: any) => {
      setReceiptError(err.response?.data?.message || 'Lỗi khi tạo phiếu nhập kho');
    },
  });

  // Adjust Stock
  const adjustStockMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/v1/inventory/materials/adjust', {
        materialId: adjustMaterialId,
        actualQuantity: Number(adjustActualQty),
        reason: adjustReason,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['material-ledger'] });
      setAdjustModalOpen(false);
      setAdjustMaterialId('');
      setAdjustActualQty(0);
      setAdjustReason('');
      setAdjustError(null);
    },
    onError: (err: any) => {
      setAdjustError(err.response?.data?.message || 'Lỗi khi điều chỉnh kiểm kê kho');
    },
  });

  // Helper reset forms
  const resetMaterialForm = () => {
    setEditingMaterial(null);
    setMatSku('');
    setMatName('');
    setMatCategoryId('');
    setMatUnit('bó');
    setMatDefaultPrice(0);
    setMatMinStockAlert(5);
    setMatNotes('');
    setMatError(null);
  };

  const openEditMaterial = (m: MaterialItem) => {
    setEditingMaterial(m);
    setMatSku(m.sku);
    setMatName(m.name);
    setMatCategoryId(m.category.id);
    setMatUnit(m.unit);
    setMatDefaultPrice(m.defaultPrice);
    setMatMinStockAlert(m.minStockAlert);
    setMatNotes(m.notes || '');
    setMatError(null);
    setMaterialModalOpen(true);
  };

  const resetPurchaseForm = () => {
    setReceiptSupplierId('');
    setReceiptPaymentMethod('CASH');
    setReceiptNotes('');
    setReceiptLines([{ materialId: '', quantity: 1, unitPrice: 0 }]);
    setReceiptError(null);
  };

  const addPurchaseLine = () => {
    setReceiptLines((prev) => [...prev, { materialId: '', quantity: 1, unitPrice: 0 }]);
  };

  const removePurchaseLine = (index: number) => {
    if (receiptLines.length > 1) {
      setReceiptLines((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updatePurchaseLine = (index: number, field: string, val: any) => {
    setReceiptLines((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: val };
        // Tự điền giá mặc định khi chọn NVL nếu unitPrice đang = 0
        if (field === 'materialId' && (!item.unitPrice || item.unitPrice === 0)) {
          const selectedMat = materials.find((m) => m.id === val);
          if (selectedMat) {
            updated.unitPrice = selectedMat.defaultPrice;
          }
        }
        return updated;
      })
    );
  };

  const receiptTotalCalc = receiptLines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
    0
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-forest-900 flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-sage-600" />
            <span>Nguyên Vật Liệu & Nhập Hàng</span>
          </h2>
          <p className="text-xs text-forest-600 mt-1">
            Quản lý kho NVL thô, tính giá vốn bình quân gia quyền di động (MWAC) và đối tác cung ứng
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                resetPurchaseForm();
                setPurchaseModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold shadow-md shadow-sage-600/20 transition-all"
            >
              <Truck className="w-4 h-4" />
              <span>+ Lập phiếu nhập kho</span>
            </button>

            <button
              onClick={() => {
                resetMaterialForm();
                setMaterialModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-sage-200 hover:border-sage-300 text-forest-800 text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm NVL mới</span>
            </button>

            <button
              onClick={() => setCategoryModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-cream-100 border border-cream-300 hover:bg-cream-200 text-forest-800 text-xs font-medium transition-all"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Danh mục</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-3xl bg-white border border-sage-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sage-100 text-sage-700 flex items-center justify-center shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-forest-500 uppercase tracking-wider">Tổng số loại NVL</span>
            <div className="text-2xl font-serif font-bold text-forest-900 mt-0.5">{totalMaterialTypes} loại</div>
            <p className="text-[11px] text-forest-500">{categories.length} nhóm phân loại</p>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-sage-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-forest-500 uppercase tracking-wider">Cảnh báo sắp hết</span>
            <div className="text-2xl font-serif font-bold text-rose-700 mt-0.5">{lowStockCount} loại</div>
            <p className="text-[11px] text-forest-500">Tồn kho &le; mức tối thiểu cảnh báo</p>
          </div>
        </div>

        {isAdmin ? (
          <div className="p-5 rounded-3xl bg-white border border-sage-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cream-200 text-forest-800 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-sage-700" />
            </div>
            <div>
              <span className="text-xs font-semibold text-forest-500 uppercase tracking-wider">Giá trị kho NVL (MWAC)</span>
              <div className="text-2xl font-serif font-bold text-forest-900 mt-0.5">{formatCurrency(totalInventoryValue)}</div>
              <p className="text-[11px] text-forest-500">Tài sản tồn kho thực tế</p>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-3xl bg-white border border-sage-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sage-50 text-sage-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-forest-500 uppercase tracking-wider">Trạng thái kho</span>
              <div className="text-xl font-serif font-bold text-forest-900 mt-0.5">Sẵn sàng sản xuất</div>
              <p className="text-[11px] text-forest-500">Cập nhật realtime từ máy chủ</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-sage-200 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'materials'
              ? 'border-sage-600 text-sage-800 bg-sage-50/50 rounded-t-xl'
              : 'border-transparent text-forest-600 hover:text-forest-900'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Danh sách Nguyên vật liệu ({materials.length})</span>
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'purchases'
                  ? 'border-sage-600 text-sage-800 bg-sage-50/50 rounded-t-xl'
                  : 'border-transparent text-forest-600 hover:text-forest-900'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Phiếu nhập kho ({purchaseReceipts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('suppliers')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'suppliers'
                  ? 'border-sage-600 text-sage-800 bg-sage-50/50 rounded-t-xl'
                  : 'border-transparent text-forest-600 hover:text-forest-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Nhà cung cấp ({suppliers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'ledger'
                  ? 'border-sage-600 text-sage-800 bg-sage-50/50 rounded-t-xl'
                  : 'border-transparent text-forest-600 hover:text-forest-900'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Sổ cái biến động kho</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: DANH SÁCH NGUYÊN VẬT LIỆU */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 bg-white rounded-2xl border border-sage-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-forest-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo tên NVL hoặc mã SKU..."
                  className="w-full pl-10 pr-4 py-2 bg-cream-50/50 border border-sage-200 rounded-xl text-xs text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-cream-50/50 border border-sage-200 rounded-xl text-xs text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
              >
                <option value="">Tất cả danh mục ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c._count.materials})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setLowStockOnly(!lowStockOnly)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  lowStockOnly
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-white text-forest-700 border-sage-200 hover:bg-cream-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Chỉ hiện sắp hết ({lowStockCount})</span>
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={() => setAdjustModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-forest-700 bg-cream-100 hover:bg-cream-200 border border-cream-300 transition-colors self-start sm:self-auto"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Kiểm kê điều chỉnh kho</span>
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-cream-50/80 border-b border-sage-200 text-forest-700 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Nguyên vật liệu</th>
                    <th className="py-3.5 px-4">Nhóm danh mục</th>
                    <th className="py-3.5 px-4 text-center">Đơn vị</th>
                    <th className="py-3.5 px-4 text-right">Tồn kho</th>
                    {isAdmin && <th className="py-3.5 px-4 text-right">Giá vốn MWAC</th>}
                    <th className="py-3.5 px-4 text-right">Giá tham khảo</th>
                    {isAdmin && <th className="py-3.5 px-4 text-right">Tổng giá trị tồn</th>}
                    <th className="py-3.5 px-4 text-center">Trạng thái</th>
                    {isAdmin && <th className="py-3.5 px-4 sm:px-6 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-100">
                  {isLoadingMaterials ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-forest-500">
                        Đang tải danh sách nguyên vật liệu...
                      </td>
                    </tr>
                  ) : materials.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-forest-500">
                        Không tìm thấy nguyên vật liệu nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    materials.map((m) => (
                      <tr key={m.id} className="hover:bg-cream-50/50 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-semibold text-forest-900">{m.name}</div>
                          <code className="text-[11px] font-mono text-sage-700 bg-sage-50 px-1.5 py-0.5 rounded border border-sage-200">
                            {m.sku}
                          </code>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-cream-100 text-forest-800 border border-cream-200">
                            {m.category.name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-medium text-forest-700">
                          {m.unit}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-bold text-sm text-forest-900">
                            {formatQuantity(m.inventory.quantity)}
                          </div>
                          {m.inventory.isLowStock && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 mt-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Tồn tối thiểu: {m.minStockAlert}
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="py-3.5 px-4 text-right font-semibold text-sage-900">
                            {formatCurrency(m.inventory.avgCost)}
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-right text-forest-600">
                          {formatCurrency(m.defaultPrice)}
                        </td>
                        {isAdmin && (
                          <td className="py-3.5 px-4 text-right font-bold text-forest-900">
                            {formatCurrency(m.inventory.totalInventoryValue)}
                          </td>
                        )}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                              m.isActive ? 'bg-emerald-500' : 'bg-forest-300'
                            }`}
                          />
                          <span className="text-[11px] text-forest-600">
                            {m.isActive ? 'Hoạt động' : 'Tạm dừng'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3.5 px-4 sm:px-6 text-right space-x-1">
                            <button
                              onClick={() => openEditMaterial(m)}
                              className="p-1.5 rounded-lg text-forest-600 hover:text-sage-700 hover:bg-sage-100 transition-colors"
                              title="Sửa thông tin"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {m.inventory.quantity === 0 && (
                              <button
                                onClick={() => {
                                  if (confirm(`Bạn có chắc muốn xóa nguyên vật liệu ${m.name}?`)) {
                                    deleteMaterialMutation.mutate(m.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors"
                                title="Xóa NVL"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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

      {/* TAB 2: PHIẾU NHẬP KHO & MWAC */}
      {activeTab === 'purchases' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-sage-100 flex items-center justify-between bg-cream-50/50">
              <span className="font-semibold text-xs text-forest-900">
                Lịch sử phiếu nhập kho ({purchaseReceipts.length} phiếu)
              </span>
              <button
                onClick={() => {
                  resetPurchaseForm();
                  setPurchaseModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Lập phiếu nhập</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-cream-50/80 border-b border-sage-200 text-forest-700 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Mã phiếu</th>
                    <th className="py-3.5 px-4">Nhà cung cấp</th>
                    <th className="py-3.5 px-4">Ngày nhập</th>
                    <th className="py-3.5 px-4 text-center">Số loại NVL</th>
                    <th className="py-3.5 px-4 text-right">Tổng tiền phiếu</th>
                    <th className="py-3.5 px-4">Người lập</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-100">
                  {isLoadingReceipts ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-forest-500">
                        Đang tải phiếu nhập kho...
                      </td>
                    </tr>
                  ) : purchaseReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-forest-500">
                        Chưa phát sinh phiếu nhập kho nào.
                      </td>
                    </tr>
                  ) : (
                    purchaseReceipts.map((r) => (
                      <tr key={r.id} className="hover:bg-cream-50/50 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-sage-900">
                          {r.code}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-forest-900">
                          {r.supplier.name}
                        </td>
                        <td className="py-3.5 px-4 text-forest-600">
                          {formatDateTime(r.receiptDate)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-sage-50 text-sage-800 border border-sage-200 font-semibold">
                            {r.itemsCount} mặt hàng
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-sm text-forest-900">
                          {formatCurrency(r.totalAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-forest-600">
                          {r.createdBy.fullName}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <button
                            onClick={() => setSelectedReceiptId(r.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium bg-sage-50 hover:bg-sage-100 text-sage-800 border border-sage-200 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ĐỐI TÁC NHÀ CUNG CẤP */}
      {activeTab === 'suppliers' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-sage-100 flex items-center justify-between bg-cream-50/50">
              <span className="font-semibold text-xs text-forest-900">
                Danh sách nhà cung cấp đối tác ({suppliers.length})
              </span>
              <button
                onClick={() => setSupplierModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm nhà cung cấp</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-cream-50/80 border-b border-sage-200 text-forest-700 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Nhà cung cấp</th>
                    <th className="py-3.5 px-4">Số điện thoại</th>
                    <th className="py-3.5 px-4">Địa chỉ kho</th>
                    <th className="py-3.5 px-4 text-center">Số lần nhập</th>
                    <th className="py-3.5 px-4 text-right">Tổng tiền nhập hàng</th>
                    <th className="py-3.5 px-4">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-100">
                  {isLoadingSuppliers ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-forest-500">
                        Đang tải danh sách nhà cung cấp...
                      </td>
                    </tr>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-forest-500">
                        Chưa có nhà cung cấp nào được tạo.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-cream-50/50 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="font-semibold text-forest-900">{s.name}</div>
                          <code className="text-[11px] font-mono text-sage-700">{s.code}</code>
                        </td>
                        <td className="py-3.5 px-4 text-forest-800 font-medium">{s.phone || '-'}</td>
                        <td className="py-3.5 px-4 text-forest-600 max-w-xs truncate">{s.address || '-'}</td>
                        <td className="py-3.5 px-4 text-center font-semibold text-forest-800">
                          {s.totalReceiptsCount} phiếu
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-forest-900">
                          {formatCurrency(s.totalPurchasedAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-forest-500 max-w-xs truncate">{s.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SỔ CÁI BIẾN ĐỘNG KHO NVL */}
      {activeTab === 'ledger' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-sage-100 bg-cream-50/50">
              <span className="font-semibold text-xs text-forest-900">
                Sổ cái biến động kho NVL (100 chứng từ gần nhất)
              </span>
              <p className="text-[11px] text-forest-500 mt-0.5">
                Bất biến: Mọi biến động nhập, xuất, kiểm kê kho đều được bảo toàn lịch sử và không thể bị sửa xóa
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-cream-50/80 border-b border-sage-200 text-forest-700 font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Mã chứng từ</th>
                    <th className="py-3.5 px-4">Thời gian</th>
                    <th className="py-3.5 px-4">Nguyên vật liệu</th>
                    <th className="py-3.5 px-4">Loại biến động</th>
                    <th className="py-3.5 px-4 text-center">Tồn trước &rarr; Sau</th>
                    <th className="py-3.5 px-4 text-right">Biến động</th>
                    <th className="py-3.5 px-4 text-right">Đơn giá vốn</th>
                    <th className="py-3.5 px-4 text-right">Thành tiền</th>
                    <th className="py-3.5 px-4 sm:px-6">Người thực hiện</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-100">
                  {isLoadingLedger ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-forest-500">
                        Đang tải sổ cái kho NVL...
                      </td>
                    </tr>
                  ) : stockLedger.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-forest-500">
                        Chưa phát sinh chứng từ biến động kho nào.
                      </td>
                    </tr>
                  ) : (
                    stockLedger.map((lg) => (
                      <tr key={lg.id} className="hover:bg-cream-50/50 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-sage-900">
                          {lg.documentCode}
                        </td>
                        <td className="py-3.5 px-4 text-forest-600">
                          {formatDateTime(lg.createdAt)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-forest-900">{lg.material.name}</span>
                          <span className="text-[11px] text-forest-500 block font-mono">{lg.material.sku}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sage-100 text-sage-800">
                            {lg.documentType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-forest-700">
                          {formatQuantity(lg.qtyBefore)} &rarr; <strong>{formatQuantity(lg.qtyAfter)}</strong>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-sage-900">
                          +{formatQuantity(lg.qtyChange)} {lg.material.unit}
                        </td>
                        <td className="py-3.5 px-4 text-right text-forest-700 font-medium">
                          {formatCurrency(lg.unitCost)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-forest-900">
                          {formatCurrency(lg.totalCost)}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-forest-600">
                          {lg.issuedBy.fullName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: THÊM / SỬA NGUYÊN VẬT LIỆU                            */}
      {/* ============================================================== */}
      {materialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-sage-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-sage-100 flex items-center justify-between bg-cream-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sage-600 text-white flex items-center justify-center shadow-sm">
                  <Boxes className="w-5 h-5 text-cream-100" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-forest-900">
                    {editingMaterial ? 'Chỉnh sửa nguyên vật liệu' : 'Thêm nguyên vật liệu mới'}
                  </h3>
                  <p className="text-[11px] text-forest-600">Định mức vật tư phục vụ sản xuất và tính giá vốn</p>
                </div>
              </div>
              <button
                onClick={() => setMaterialModalOpen(false)}
                className="p-1.5 rounded-lg text-forest-500 hover:bg-sage-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMaterialMutation.mutate();
              }}
              className="p-6 space-y-4 overflow-y-auto flex-1"
            >
              {matError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{matError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">
                  Tên nguyên vật liệu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={matName}
                  onChange={(e) => setMatName(e.target.value)}
                  placeholder="VD: Kẽm nhung Tím khói (bó 100 sợi)"
                  className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>

              {editingMaterial ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-forest-800 mb-1">
                      Mã SKU
                    </label>
                    <input
                      type="text"
                      disabled
                      value={matSku}
                      className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 font-mono opacity-70 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-forest-800 mb-1">
                      Danh mục
                    </label>
                    <select
                      value={matCategoryId}
                      onChange={(e) => setMatCategoryId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                    >
                      <option value="">-- Chọn nhóm danh mục --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-forest-800 mb-1">
                    Nhóm danh mục
                  </label>
                  <select
                    value={matCategoryId}
                    onChange={(e) => setMatCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  >
                    <option value="">-- Mặc định (hoặc chọn nhóm danh mục) --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest-800 mb-1">
                    Đơn vị tính <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={matUnit}
                    onChange={(e) => setMatUnit(e.target.value)}
                    placeholder="bó, cuộn, cây..."
                    className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-800 mb-1">
                    Giá tham khảo (₫)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={matDefaultPrice}
                    onChange={(e) => setMatDefaultPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-800 mb-1">
                    Cảnh báo tồn min
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={matMinStockAlert}
                    onChange={(e) => setMatMinStockAlert(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={matNotes}
                  onChange={(e) => setMatNotes(e.target.value)}
                  placeholder="Ghi chú thêm về chất liệu, nguồn gốc..."
                  className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>

              <div className="pt-3 border-t border-sage-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMaterialModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-forest-600 hover:bg-sage-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saveMaterialMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-sage-600 text-white hover:bg-sage-700 shadow-sm disabled:opacity-60"
                >
                  {saveMaterialMutation.isPending ? 'Đang lưu...' : 'Lưu nguyên vật liệu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: LẬP PHIẾU NHẬP KHO (TÍNH GIÁ VỐN MWAC)                */}
      {/* ============================================================== */}
      {purchaseModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-sage-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-sage-100 flex items-center justify-between bg-cream-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sage-600 text-white flex items-center justify-center shadow-sm">
                  <Truck className="w-5 h-5 text-cream-100" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-forest-900">Lập Phiếu Nhập Kho</h3>
                  <p className="text-[11px] text-forest-600">
                    Cập nhật tồn kho, tính giá vốn bình quân MWAC và tự động ghi sổ quỹ chi tiền
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPurchaseModalOpen(false)}
                className="p-1.5 rounded-lg text-forest-500 hover:bg-sage-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPurchaseReceiptMutation.mutate();
              }}
              className="p-6 space-y-4 overflow-y-auto flex-1"
            >
              {receiptError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{receiptError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest-800 mb-1">
                    Nhà cung cấp đối tác <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={receiptSupplierId}
                    onChange={(e) => setReceiptSupplierId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  >
                    <option value="">-- Chọn nhà cung cấp --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-800 mb-1">
                    Hình thức thanh toán tiền nhập
                  </label>
                  <select
                    value={receiptPaymentMethod}
                    onChange={(e) => setReceiptPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  >
                    <option value="CASH">Tiền mặt (Sổ quỹ tiền mặt)</option>
                    <option value="BANK_TRANSFER">Chuyển khoản (Ngân hàng)</option>
                  </select>
                </div>
              </div>

              {/* Danh sách mặt hàng nhập */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-forest-800">
                  <span>Chi tiết nguyên vật liệu nhập kho ({receiptLines.length} mặt hàng)</span>
                  <button
                    type="button"
                    onClick={addPurchaseLine}
                    className="inline-flex items-center gap-1 text-sage-700 hover:text-sage-900 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm mặt hàng</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {receiptLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-cream-50/70 border border-sage-200 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-6">
                        <label className="block text-[10px] text-forest-600 mb-0.5">Chọn NVL</label>
                        <select
                          required
                          value={line.materialId}
                          onChange={(e) => updatePurchaseLine(idx, 'materialId', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-sage-200 rounded-lg text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                        >
                          <option value="">-- Chọn NVL --</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.sku} - {m.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-forest-600 mb-0.5">Số lượng</label>
                        <input
                          type="number"
                          required
                          min="0.1"
                          step="any"
                          value={line.quantity}
                          onChange={(e) => updatePurchaseLine(idx, 'quantity', Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-sage-200 rounded-lg text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500 text-right"
                        />
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] text-forest-600 mb-0.5">Đơn giá mua (₫)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={line.unitPrice}
                          onChange={(e) => updatePurchaseLine(idx, 'unitPrice', Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-sage-200 rounded-lg text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500 text-right font-medium"
                        />
                      </div>

                      <div className="col-span-1 text-center pt-3">
                        <button
                          type="button"
                          disabled={receiptLines.length === 1}
                          onClick={() => removePurchaseLine(idx)}
                          className="text-forest-400 hover:text-rose-600 disabled:opacity-30 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tổng tiền & Ghi chú */}
              <div className="pt-2 border-t border-sage-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-forest-700">Tổng tiền thanh toán phiếu nhập:</span>
                <span className="text-lg font-serif font-bold text-forest-900">
                  {formatCurrency(receiptTotalCalc)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">Ghi chú phiếu nhập</label>
                <input
                  type="text"
                  value={receiptNotes}
                  onChange={(e) => setReceiptNotes(e.target.value)}
                  placeholder="Ghi chú số hóa đơn, tình trạng hàng hóa..."
                  className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>

              <div className="pt-3 border-t border-sage-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPurchaseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-forest-600 hover:bg-sage-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createPurchaseReceiptMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-sage-600 text-white hover:bg-sage-700 shadow-md shadow-sage-600/20 disabled:opacity-60"
                >
                  {createPurchaseReceiptMutation.isPending ? 'Đang hạch toán MWAC...' : 'Xác nhận nhập kho & Tính giá vốn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: XEM CHI TIẾT PHIẾU NHẬP KHO                           */}
      {/* ============================================================== */}
      {selectedReceiptId && receiptDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-sage-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-sage-100 flex items-center justify-between bg-cream-50">
              <div>
                <h3 className="font-serif text-base font-bold text-forest-900">
                  Chi tiết Phiếu Nhập: {receiptDetail.code}
                </h3>
                <p className="text-[11px] text-forest-600">
                  NCC: <strong>{receiptDetail.supplier.name}</strong> • Ngày: {formatDateTime(receiptDetail.receiptDate)}
                </p>
              </div>
              <button
                onClick={() => setSelectedReceiptId(null)}
                className="p-1.5 rounded-lg text-forest-500 hover:bg-sage-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="rounded-2xl border border-sage-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-cream-100 text-forest-800 font-semibold">
                      <th className="p-2.5">NVL</th>
                      <th className="p-2.5 text-right">SL</th>
                      <th className="p-2.5 text-right">Đơn giá</th>
                      <th className="p-2.5 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sage-100">
                    {receiptDetail.items.map((it: any) => (
                      <tr key={it.id}>
                        <td className="p-2.5">
                          <div className="font-semibold text-forest-900">{it.material.name}</div>
                          <code className="text-[10px] text-sage-700">{it.material.sku}</code>
                        </td>
                        <td className="p-2.5 text-right font-medium">
                          {formatQuantity(it.quantity)} {it.material.unit}
                        </td>
                        <td className="p-2.5 text-right">{formatCurrency(it.unitPrice)}</td>
                        <td className="p-2.5 text-right font-bold text-forest-900">{formatCurrency(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-xl bg-sage-50 border border-sage-200 flex items-center justify-between font-bold">
                <span>Tổng giá trị phiếu nhập:</span>
                <span className="text-sm font-serif text-forest-900">{formatCurrency(receiptDetail.totalAmount)}</span>
              </div>

              {receiptDetail.financialTransactions?.length > 0 && (
                <div className="text-[11px] text-forest-600 bg-cream-50 p-3 rounded-xl border border-cream-200">
                  <div className="font-semibold text-forest-800 mb-0.5">Bút toán sổ quỹ tự động:</div>
                  Mã phiếu chi: <strong>{receiptDetail.financialTransactions[0].code}</strong> • Số tiền:{' '}
                  <strong>{formatCurrency(receiptDetail.financialTransactions[0].amount)}</strong> • Hình thức:{' '}
                  {receiptDetail.financialTransactions[0].paymentMethod}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-sage-100 flex justify-end">
              <button
                onClick={() => setSelectedReceiptId(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-sage-600 text-white hover:bg-sage-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: KIỂM KÊ ĐIỀU CHỈNH KHO NVL                            */}
      {/* ============================================================== */}
      {adjustModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-sage-200 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-sage-100 flex items-center justify-between bg-cream-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
                  <Edit3 className="w-5 h-5 text-cream-100" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-forest-900">Kiểm kê điều chỉnh kho</h3>
                  <p className="text-[11px] text-forest-600">Khớp số lượng tồn thực tế và tạo chứng từ kiểm kê</p>
                </div>
              </div>
              <button onClick={() => setAdjustModalOpen(false)} className="p-1.5 text-forest-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                adjustStockMutation.mutate();
              }}
              className="p-6 space-y-4"
            >
              {adjustError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{adjustError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">
                  Chọn nguyên vật liệu kiểm kê <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={adjustMaterialId}
                  onChange={(e) => {
                    setAdjustMaterialId(e.target.value);
                    const selected = materials.find((m) => m.id === e.target.value);
                    if (selected) {
                      setAdjustActualQty(selected.inventory.quantity);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                >
                  <option value="">-- Chọn NVL kiểm kê --</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Tồn hiện tại: {m.inventory.quantity} {m.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">
                  Số lượng tồn thực tế sau kiểm kê <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={adjustActualQty}
                  onChange={(e) => setAdjustActualQty(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500 text-right font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">
                  Lý do điều chỉnh kiểm kê <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="VD: Kiểm kê định kỳ cuối tháng, hao hụt kẽm lỗi..."
                  className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>

              <div className="pt-3 border-t border-sage-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-forest-600 hover:bg-sage-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={adjustStockMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm disabled:opacity-60"
                >
                  {adjustStockMutation.isPending ? 'Đang ghi chứng từ...' : 'Lưu kết quả kiểm kê'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: QUẢN LÝ NHÓM DANH MỤC NVL                             */}
      {/* ============================================================== */}
      {categoryModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-sage-200 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-sage-100 flex items-center justify-between bg-cream-50">
              <h3 className="font-serif text-base font-bold text-forest-900">Quản lý Nhóm Danh Mục NVL</h3>
              <button onClick={() => setCategoryModalOpen(false)} className="p-1.5 text-forest-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {catError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {catError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createCategoryMutation.mutate();
                }}
                className="space-y-3 p-3 bg-cream-50/70 rounded-2xl border border-sage-200"
              >
                <div className="text-xs font-semibold text-forest-800">Thêm danh mục mới:</div>
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tên nhóm danh mục (VD: Ruy băng, Giấy gói...)"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-sage-200 rounded-xl text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={createCategoryMutation.isPending}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-sage-600 text-white hover:bg-sage-700 shadow-sm"
                >
                  {createCategoryMutation.isPending ? 'Đang tạo...' : '+ Thêm nhóm danh mục'}
                </button>
              </form>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                <div className="text-xs font-semibold text-forest-700">Các nhóm hiện có:</div>
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-xl border border-sage-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-forest-900">{c.name}</span>
                      <code className="text-[10px] text-sage-700 ml-2">({c.code})</code>
                    </div>
                    <span className="text-[11px] text-forest-500">{c._count.materials} loại NVL</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-sage-100 flex justify-end">
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-sage-600 text-white hover:bg-sage-700"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 6: THÊM NHÀ CUNG CẤP                                     */}
      {/* ============================================================== */}
      {supplierModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full border border-sage-200 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-sage-100 flex items-center justify-between bg-cream-50">
              <h3 className="font-serif text-base font-bold text-forest-900">Thêm Nhà Cung Cấp Đối Tác</h3>
              <button onClick={() => setSupplierModalOpen(false)} className="p-1.5 text-forest-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createSupplierMutation.mutate();
              }}
              className="p-6 space-y-3"
            >
              {supError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {supError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">
                  Tên nhà cung cấp <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Đại lý Kẽm Nhung & Phụ Kiện Sỉ"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">Số điện thoại</label>
                <input
                  type="text"
                  placeholder="VD: 0988 888 999"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">Địa chỉ kho/cửa hàng</label>
                <input
                  type="text"
                  placeholder="VD: 120 Cầu Giấy, Hà Nội"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-800 mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  placeholder="Chính sách chiết khấu, thời gian giao hàng..."
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-cream-50/50 border border-sage-200 rounded-xl"
                />
              </div>

              <div className="pt-2 border-t border-sage-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSupplierModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-forest-600 hover:bg-sage-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createSupplierMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-60"
                >
                  {createSupplierMutation.isPending ? 'Đang tạo...' : 'Tạo nhà cung cấp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
