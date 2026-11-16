import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import {
  ShoppingBag,
  Plus,
  Search,
  Clock,
  Truck,
  DollarSign,
  CreditCard,
  Trash2,
  X,
  AlertCircle,
  Eye,
  Calendar,
  Phone,
} from 'lucide-react';

interface OrderListItem {
  id: string;
  code: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'READY' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';
  subtotal: number;
  discountAmount: number;
  shippingFeeCollected: number;
  shippingCostPaid: number;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  remainingAmount: number;
  totalCogs?: number;
  deliveryAddress: string | null;
  notes: string | null;
  createdAt: string;
  customer: { id: string; code: string; fullName: string; phone: string };
  createdBy: { id: string; fullName: string; username: string };
  itemsSummary: Array<{ productName: string; productSku: string; quantity: number }>;
  itemsCount: number;
  paymentsCount: number;
  hasLinkedProduction: boolean;
}

interface OrderDetail extends OrderListItem {
  grossProfit?: number;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    productType: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
    unitCogsSnapshot?: number;
    discount: number;
    lineTotal: number;
    currentAvailableStock: number;
  }>;
  payments: Array<{
    id: string;
    code: string;
    paymentType: string;
    paymentMethod: string;
    amount: number;
    paymentDate: string;
    transactionReference: string | null;
    notes: string | null;
    collectedBy: { id: string; fullName: string; username: string };
  }>;
  productionOrders: Array<{
    id: string;
    code: string;
    status: string;
    plannedQuantity: number;
    completedQuantity: number;
  }>;
}

export function OrdersPage() {
  const { user } = useAuth();
  const isAdmin = user?.roleId === 'ADMIN';
  const queryClient = useQueryClient();

  // Filters
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Customer Option
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ fullName: '', phone: '', address: '' });

  // Create Order Form
  const [createForm, setCreateForm] = useState({
    customerId: '',
    expectedDeliveryDate: '',
    deliveryAddress: '',
    discountAmount: 0,
    shippingFeeCollected: 0,
    depositAmount: 0,
    depositPaymentMethod: 'CASH' as 'CASH' | 'BANK_TRANSFER',
    notes: '',
    createMtoProduction: false,
    items: [
      {
        productId: '',
        quantity: 1,
        unitPrice: 0,
        discount: 0,
      },
    ],
  });

  // Payment Form
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    paymentMethod: 'CASH' as 'CASH' | 'BANK_TRANSFER',
    paymentType: 'FINAL_PAYMENT' as 'FINAL_PAYMENT' | 'DEPOSIT' | 'FULL_PAYMENT',
    notes: '',
  });

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const { data: orders = [], isLoading: isLoadingOrders } = useQuery<OrderListItem[]>({
    queryKey: ['orders', activeTab, searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (activeTab !== 'ALL') params.status = activeTab;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await api.get('/orders', { params });
      return res.data.data;
    },
  });

  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const res = await api.get('/customers');
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

  const { data: orderDetail } = useQuery<OrderDetail>({
    queryKey: ['order-detail', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null as any;
      const res = await api.get(`/orders/${selectedOrderId}`);
      return res.data.data;
    },
    enabled: !!selectedOrderId,
  });

  // ==========================================
  // MUTATIONS
  // ==========================================

  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.post('/orders', payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory'] });
      setIsCreateModalOpen(false);
      setSelectedOrderId(res.data.data.id);
      resetCreateForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Lỗi khi tạo đơn hàng');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes, cancellationReason }: any) => {
      return api.patch(`/orders/${id}/status`, { status, notes, cancellationReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Lỗi khi cập nhật trạng thái đơn hàng');
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async ({ orderId, payload }: any) => {
      return api.post(`/orders/${orderId}/payments`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      setIsPaymentModalOpen(false);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Lỗi khi ghi nhận thanh toán');
    },
  });

  // Helpers
  const resetCreateForm = () => {
    setIsNewCustomer(false);
    setNewCustomer({ fullName: '', phone: '', address: '' });
    setCreateForm({
      customerId: customers[0]?.id || '',
      expectedDeliveryDate: '',
      deliveryAddress: '',
      discountAmount: 0,
      shippingFeeCollected: 0,
      depositAmount: 0,
      depositPaymentMethod: 'CASH',
      notes: '',
      createMtoProduction: false,
      items: [
        {
          productId: products[0]?.id || '',
          quantity: 1,
          unitPrice: products[0]?.sellingPrice || 0,
          discount: 0,
        },
      ],
    });
    setFormError(null);
  };

  const handleOpenCreateModal = () => {
    resetCreateForm();
    if (customers.length > 0) {
      setCreateForm((prev) => ({ ...prev, customerId: customers[0].id }));
    }
    if (products.length > 0) {
      setCreateForm((prev) => ({
        ...prev,
        items: [
          {
            productId: products[0].id,
            quantity: 1,
            unitPrice: products[0].sellingPrice,
            discount: 0,
          },
        ],
      }));
    }
    setIsCreateModalOpen(true);
  };

  const handleAddItemRow = () => {
    const firstProd = products[0];
    setCreateForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productId: firstProd?.id || '',
          quantity: 1,
          unitPrice: firstProd?.sellingPrice || 0,
          discount: 0,
        },
      ],
    }));
  };

  const handleRemoveItemRow = (index: number) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleItemProductChange = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setCreateForm((prev) => {
      const copy = [...prev.items];
      copy[index] = {
        ...copy[index],
        productId,
        unitPrice: prod ? prod.sellingPrice : copy[index].unitPrice,
      };
      return { ...prev, items: copy };
    });
  };

  const handleItemFieldChange = (index: number, field: string, value: any) => {
    setCreateForm((prev) => {
      const copy = [...prev.items];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, items: copy };
    });
  };

  const calculateFormSubtotal = () => {
    return createForm.items.reduce(
      (sum, it) => sum + (it.quantity * it.unitPrice - (it.discount || 0)),
      0
    );
  };

  const calculateFormTotal = () => {
    return (
      calculateFormSubtotal() -
      (createForm.discountAmount || 0) +
      (createForm.shippingFeeCollected || 0)
    );
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isNewCustomer) {
      if (!newCustomer.fullName.trim()) {
        setFormError('Vui lòng nhập họ tên khách hàng');
        return;
      }
      if (!newCustomer.phone.trim()) {
        setFormError('Vui lòng nhập số điện thoại khách hàng');
        return;
      }
    } else {
      if (!createForm.customerId) {
        setFormError('Vui lòng chọn khách hàng');
        return;
      }
    }

    if (createForm.items.length === 0) {
      setFormError('Đơn hàng phải có ít nhất 1 sản phẩm');
      return;
    }

    const payload: any = {
      expectedDeliveryDate: createForm.expectedDeliveryDate || undefined,
      deliveryAddress: createForm.deliveryAddress || undefined,
      items: createForm.items.map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        discount: Number(it.discount || 0),
      })),
      discountAmount: Number(createForm.discountAmount || 0),
      shippingFeeCollected: Number(createForm.shippingFeeCollected || 0),
      depositAmount: Number(createForm.depositAmount || 0),
      depositPaymentMethod: createForm.depositPaymentMethod,
      notes: createForm.notes.trim() || undefined,
      createMtoProduction: createForm.createMtoProduction,
    };

    if (isNewCustomer) {
      payload.customer = {
        fullName: newCustomer.fullName.trim(),
        phone: newCustomer.phone.trim(),
        address: newCustomer.address.trim() || undefined,
      };
    } else {
      payload.customerId = createForm.customerId;
    }

    createOrderMutation.mutate(payload);
  };

  // Metrics
  const totalOrdersCount = orders.length;
  const processingCount = orders.filter((o) => ['CONFIRMED', 'PROCESSING', 'READY'].includes(o.status)).length;
  const shippingCount = orders.filter((o) => o.status === 'SHIPPING').length;
  const totalRevenue = orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const totalUnpaid = orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.remainingAmount, 0);

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-sage-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sage-100 flex items-center justify-center text-sage-700">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-forest-900">
              Quản lý Đơn Hàng & Bán Hàng
            </h1>
            <p className="text-sm text-forest-600">
              Bán sẵn trừ kho, đặt trước sản xuất (MTO), giữ chỗ tồn kho và quản lý tiền cọc
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Tạo Đơn Hàng Mới
        </button>
      </div>

      {/* 2. Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Doanh số đơn hàng</span>
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-forest-900">{formatCurrency(totalRevenue)}</div>
          <div className="text-xs text-forest-500 mt-1">Tổng giá trị đơn hợp lệ</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Đang cắm / xử lý</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{processingCount}</div>
          <div className="text-xs text-forest-500 mt-1">Đơn đã chốt cần làm hoa</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Đang giao hoa</span>
            <Truck className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-700">{shippingCount}</div>
          <div className="text-xs text-forest-500 mt-1">Đang trên đường đến khách</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between text-forest-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Chưa thu hết tiền</span>
            <CreditCard className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">{formatCurrency(totalUnpaid)}</div>
          <div className="text-xs text-forest-500 mt-1">Tiền cọc hoặc thanh toán còn lại</div>
        </div>
      </div>

      {/* 3. Status Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-sage-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap bg-cream-100 p-1 rounded-xl w-full md:w-auto">
          {[
            { key: 'ALL', label: `Tất cả (${totalOrdersCount})` },
            { key: 'PENDING', label: 'Mới tạo' },
            { key: 'CONFIRMED', label: 'Đã xác nhận' },
            { key: 'PROCESSING', label: 'Đang cắm hoa' },
            { key: 'READY', label: 'Sẵn sàng giao' },
            { key: 'SHIPPING', label: 'Đang giao' },
            { key: 'COMPLETED', label: 'Hoàn tất' },
            { key: 'CANCELLED', label: 'Đã hủy' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === t.key
                  ? 'bg-white text-forest-900 shadow-sm font-semibold'
                  : 'text-forest-600 hover:text-forest-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
          <input
            type="text"
            placeholder="Tìm mã đơn, tên hoặc SĐT khách..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800 placeholder-forest-400"
          />
        </div>
      </div>

      {/* 4. Orders Table */}
      <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cream-100 text-forest-700 font-semibold border-b border-sage-200">
              <tr>
                <th className="py-3.5 px-4">Mã đơn</th>
                <th className="py-3.5 px-4">Khách hàng</th>
                <th className="py-3.5 px-4">Mặt hàng</th>
                <th className="py-3.5 px-4 text-right">Tổng tiền</th>
                <th className="py-3.5 px-4 text-right">Đã trả / Còn thiếu</th>
                <th className="py-3.5 px-4 text-center">Trạng thái</th>
                <th className="py-3.5 px-4">Hẹn giao</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage-100 text-forest-800">
              {isLoadingOrders ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-forest-400">
                    Đang tải danh sách đơn hàng...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-forest-400">
                    Chưa có đơn hàng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-cream-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold text-sage-800">
                      {o.code}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-forest-900">{o.customer.fullName}</div>
                      <div className="text-xs text-forest-500 font-mono flex items-center gap-1">
                        <Phone className="w-3 h-3 text-sage-600" />
                        {o.customer.phone}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs">
                      <div className="text-forest-800 font-medium">
                        {o.itemsSummary.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
                      </div>
                      <div className="text-[10px] text-forest-400 mt-0.5">
                        {o.itemsCount} mặt hàng {o.hasLinkedProduction && '• 🛠️ Có Lệnh SX (MTO)'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-forest-900">
                      {formatCurrency(o.totalAmount)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="text-xs font-semibold text-emerald-700">
                        {formatCurrency(o.paidAmount)}
                      </div>
                      {o.remainingAmount > 0 ? (
                        <div className="text-[10px] font-bold text-rose-600">
                          Thiếu: {formatCurrency(o.remainingAmount)}
                        </div>
                      ) : (
                        <div className="text-[10px] text-emerald-600">Đã đủ 100%</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {o.status === 'PENDING' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          Mới tạo
                        </span>
                      )}
                      {o.status === 'CONFIRMED' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          Đã xác nhận
                        </span>
                      )}
                      {o.status === 'PROCESSING' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          Đang cắm hoa
                        </span>
                      )}
                      {o.status === 'READY' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                          Sẵn sàng giao
                        </span>
                      )}
                      {o.status === 'SHIPPING' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                          Đang giao
                        </span>
                      )}
                      {o.status === 'COMPLETED' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          Hoàn tất
                        </span>
                      )}
                      {o.status === 'CANCELLED' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                          Đã hủy
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-forest-600">
                      {o.expectedDeliveryDate ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-sage-600" />
                          {formatDateTime(o.expectedDeliveryDate)}
                        </span>
                      ) : (
                        '-'
                      )}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================== */}
      {/* 5. MODAL TẠO ĐƠN HÀNG MỚI                  */}
      {/* ========================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="p-6 border-b border-sage-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-sage-600" />
                <h3 className="font-serif font-bold text-lg text-forest-900">
                  Tạo Đơn Hàng Mới
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-forest-400 hover:text-forest-700 rounded-xl hover:bg-cream-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Customer Selector / Quick Add Customer */}
              <div className="p-4 bg-cream-50 rounded-2xl border border-sage-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase text-forest-700">
                    Thông tin khách hàng <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomer(!isNewCustomer)}
                    className="text-xs font-semibold text-sage-700 hover:text-sage-900 underline"
                  >
                    {isNewCustomer ? 'Chọn khách hàng có sẵn' : '+ Thêm khách hàng mới'}
                  </button>
                </div>

                {isNewCustomer ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Họ tên khách *"
                      value={newCustomer.fullName}
                      onChange={(e) => setNewCustomer({ ...newCustomer, fullName: e.target.value })}
                      className="px-3 py-2 bg-white border border-sage-300 rounded-xl text-xs focus:ring-1 focus:ring-sage-500"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Số điện thoại *"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      className="px-3 py-2 bg-white border border-sage-300 rounded-xl text-xs font-mono focus:ring-1 focus:ring-sage-500"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Địa chỉ giao hoa"
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                      className="px-3 py-2 bg-white border border-sage-300 rounded-xl text-xs focus:ring-1 focus:ring-sage-500"
                    />
                  </div>
                ) : (
                  <select
                    value={createForm.customerId}
                    onChange={(e) => setCreateForm({ ...createForm, customerId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-sage-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                    required
                  >
                    <option value="" disabled>
                      Chọn khách hàng
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.code}] {c.fullName} - {c.phone}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase text-forest-700">
                    Sản phẩm trong đơn hàng
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-3 py-1 bg-sage-100 hover:bg-sage-200 text-sage-800 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm món hoa
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {createForm.items.map((it, idx) => {
                    const prod = products.find((p) => p.id === it.productId);
                    const availableStock = prod?.inventory?.availableQuantity || 0;
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-cream-50 rounded-2xl border border-sage-200 flex flex-col sm:flex-row items-center gap-2 text-xs"
                      >
                        <div className="flex-1 w-full sm:w-auto">
                          <select
                            value={it.productId}
                            onChange={(e) => handleItemProductChange(idx, e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-sage-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-sage-500"
                            required
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.sku}] {p.name} - Giá: {formatCurrency(p.sellingPrice)} (Còn:{' '}
                                {p.inventory?.availableQuantity || 0})
                              </option>
                            ))}
                          </select>
                          {it.quantity > availableStock && (
                            <span className="text-[10px] text-amber-600 font-medium">
                              ⚠️ Vượt kho sẵn ({availableStock}). Có thể tạo lệnh MTO bổ sung.
                            </span>
                          )}
                        </div>

                        <div className="w-20">
                          <label className="text-[10px] text-forest-500 block">Số lượng</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={it.quantity}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'quantity', parseInt(e.target.value) || 1)
                            }
                            className="w-full px-2 py-1 bg-white border border-sage-300 rounded-xl text-xs text-right font-bold"
                            required
                          />
                        </div>

                        <div className="w-28">
                          <label className="text-[10px] text-forest-500 block">Đơn giá bán</label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={it.unitPrice}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'unitPrice', Number(e.target.value))
                            }
                            className="w-full px-2 py-1 bg-white border border-sage-300 rounded-xl text-xs text-right font-semibold"
                            required
                          />
                        </div>

                        <div className="w-24 text-right pt-3">
                          <div className="text-[10px] text-forest-400">Thành tiền:</div>
                          <div className="font-bold text-forest-900">
                            {formatCurrency(it.quantity * it.unitPrice)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                          title="Xóa món"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delivery info & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Thời gian hẹn giao hoa
                  </label>
                  <input
                    type="datetime-local"
                    value={createForm.expectedDeliveryDate}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, expectedDeliveryDate: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Địa chỉ nhận hoa
                  </label>
                  <input
                    type="text"
                    placeholder="Số nhà, đường, quận/huyện..."
                    value={createForm.deliveryAddress}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, deliveryAddress: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sage-500 text-forest-800"
                  />
                </div>
              </div>

              {/* Pricing, Discount, Shipping */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-cream-50 rounded-2xl border border-sage-200">
                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Giảm giá đơn hàng (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={createForm.discountAmount}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, discountAmount: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-sage-300 rounded-xl text-xs text-right font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Phí ship thu từ khách (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={createForm.shippingFeeCollected}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, shippingFeeCollected: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-sage-300 rounded-xl text-xs text-right font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">
                    Tiền cọc thu ngay (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={createForm.depositAmount}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, depositAmount: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-sage-300 rounded-xl text-xs text-right font-bold text-emerald-700"
                  />
                </div>
              </div>

              {/* Deposit Method & MTO Toggle */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {createForm.depositAmount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-forest-600 font-semibold">Hình thức thu cọc:</span>
                    <select
                      value={createForm.depositPaymentMethod}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          depositPaymentMethod: e.target.value as any,
                        })
                      }
                      className="px-2.5 py-1 bg-cream-50 border border-sage-300 rounded-xl text-xs"
                    >
                      <option value="CASH">Tiền mặt</option>
                      <option value="BANK_TRANSFER">Chuyển khoản</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mtoToggle"
                    checked={createForm.createMtoProduction}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, createMtoProduction: e.target.checked })
                    }
                    className="w-4 h-4 text-sage-600 rounded"
                  />
                  <label htmlFor="mtoToggle" className="text-xs text-forest-800 cursor-pointer">
                    Tự động tạo Lệnh Sản Xuất theo đơn (Make to Order)
                  </label>
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-4 bg-sage-50 rounded-2xl border border-sage-300 flex items-center justify-between text-sm">
                <div>
                  <span className="text-forest-600">Tổng thanh toán: </span>
                  <span className="text-xl font-bold text-forest-900">
                    {formatCurrency(calculateFormTotal())}
                  </span>
                </div>
                {createForm.depositAmount > 0 && (
                  <div className="text-xs text-forest-600">
                    Đã cọc: <strong>{formatCurrency(createForm.depositAmount)}</strong> • Còn thiếu:{' '}
                    <strong className="text-rose-600">
                      {formatCurrency(Math.max(0, calculateFormTotal() - createForm.depositAmount))}
                    </strong>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-sage-200">
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
                  {createOrderMutation.isPending ? 'Đang tạo...' : 'Xác nhận tạo đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 6. MODAL CHI TIẾT ĐƠN HÀNG                 */}
      {/* ========================================== */}
      {selectedOrderId && orderDetail && (
        <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-sage-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-lg text-forest-900">
                    Chi tiết Đơn hàng {orderDetail.code}
                  </h3>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cream-200 text-forest-800">
                    {orderDetail.status}
                  </span>
                </div>
                <p className="text-xs text-forest-500 mt-0.5">
                  Khách: <strong>{orderDetail.customer.fullName}</strong> ({orderDetail.customer.phone}) • Lập bởi {orderDetail.createdBy.fullName} lúc {formatDateTime(orderDetail.createdAt)}
                </p>
              </div>

              <button
                onClick={() => setSelectedOrderId(null)}
                className="p-2 text-forest-400 hover:text-forest-700 rounded-xl hover:bg-cream-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Stepper Status Progression */}
              <div className="p-4 bg-cream-50 rounded-2xl border border-sage-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-forest-700">Tiến trình đơn hàng</span>
                  {orderDetail.status !== 'COMPLETED' && orderDetail.status !== 'CANCELLED' && (
                    <div className="flex items-center gap-2">
                      {orderDetail.status === 'PENDING' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: orderDetail.id, status: 'CONFIRMED' })}
                          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm"
                        >
                          Xác nhận đơn hàng
                        </button>
                      )}
                      {orderDetail.status === 'CONFIRMED' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: orderDetail.id, status: 'PROCESSING' })}
                          className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-sm"
                        >
                          Bắt đầu cắm hoa
                        </button>
                      )}
                      {orderDetail.status === 'PROCESSING' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: orderDetail.id, status: 'READY' })}
                          className="px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-semibold shadow-sm"
                        >
                          Hoa đã sẵn sàng giao
                        </button>
                      )}
                      {orderDetail.status === 'READY' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: orderDetail.id, status: 'SHIPPING' })}
                          className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-sm"
                        >
                          Xuất giao cho khách
                        </button>
                      )}
                      {orderDetail.status === 'SHIPPING' && (
                        <button
                          onClick={() => {
                            if (window.confirm('Hoàn tất đơn hàng và xuất kho thành phẩm thực tế?')) {
                              updateStatusMutation.mutate({ id: orderDetail.id, status: 'COMPLETED' });
                            }
                          }}
                          className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow-sm"
                        >
                          Khách đã nhận / Hoàn tất
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const reason = prompt('Nhập lý do hủy đơn hàng:');
                          if (reason && reason.trim()) {
                            updateStatusMutation.mutate({
                              id: orderDetail.id,
                              status: 'CANCELLED',
                              cancellationReason: reason.trim(),
                            });
                          }
                        }}
                        className="px-3 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold"
                      >
                        Hủy đơn
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  {['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPING', 'COMPLETED'].map((st, i) => {
                    const isPassed =
                      ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPING', 'COMPLETED'].indexOf(orderDetail.status) >= i;
                    return (
                      <div key={st} className="flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                            isPassed ? 'bg-sage-600 text-white' : 'bg-cream-200 text-forest-400'
                          }`}
                        >
                          {i + 1}
                        </div>
                        <span className="text-[10px] mt-1 text-forest-600">
                          {st === 'PENDING' && 'Mới tạo'}
                          {st === 'CONFIRMED' && 'Đã duyệt'}
                          {st === 'PROCESSING' && 'Đang làm'}
                          {st === 'READY' && 'Sẵn sàng'}
                          {st === 'SHIPPING' && 'Đang giao'}
                          {st === 'COMPLETED' && 'Hoàn tất'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-forest-900">Danh sách hoa & phụ kiện</h4>
                <div className="overflow-x-auto rounded-2xl border border-sage-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-cream-100 text-forest-700 font-semibold border-b border-sage-200">
                      <tr>
                        <th className="py-2.5 px-3">Sản phẩm</th>
                        <th className="py-2.5 px-3 text-center">SL</th>
                        <th className="py-2.5 px-3 text-right">Đơn giá</th>
                        {isAdmin && <th className="py-2.5 px-3 text-right">Giá vốn (COGS)</th>}
                        <th className="py-2.5 px-3 text-right">Giảm giá</th>
                        <th className="py-2.5 px-3 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sage-100 text-forest-800">
                      {orderDetail.items.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2.5 px-3 font-semibold text-forest-900">
                            {it.productName}
                            <span className="text-[10px] text-forest-400 font-mono ml-1.5">[{it.productSku}]</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">{it.quantity}</td>
                          <td className="py-2.5 px-3 text-right">{formatCurrency(it.unitPrice)}</td>
                          {isAdmin && (
                            <td className="py-2.5 px-3 text-right text-forest-500">
                              {formatCurrency(it.unitCogsSnapshot)}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-right text-forest-500">{formatCurrency(it.discount)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-forest-900">
                            {formatCurrency(it.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Calculation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 p-4 bg-cream-50 rounded-2xl border border-sage-200 text-xs">
                  <div className="flex justify-between">
                    <span className="text-forest-600">Tiền hàng:</span>
                    <span className="font-semibold">{formatCurrency(orderDetail.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-forest-600">Giảm giá:</span>
                    <span className="text-rose-600">-{formatCurrency(orderDetail.discountAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-forest-600">Phí vận chuyển thu khách:</span>
                    <span>+{formatCurrency(orderDetail.shippingFeeCollected)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-sage-200 font-bold text-sm text-forest-900">
                    <span>Tổng hóa đơn:</span>
                    <span>{formatCurrency(orderDetail.totalAmount)}</span>
                  </div>
                  {isAdmin && (
                    <div className="flex justify-between pt-1 text-[11px] text-emerald-800 font-semibold">
                      <span>Lãi gộp ước tính:</span>
                      <span>{formatCurrency(orderDetail.grossProfit)}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 p-4 bg-sage-50 rounded-2xl border border-sage-300 text-xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-forest-600">Đã thanh toán / đặt cọc:</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(orderDetail.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-forest-600">Còn phải thu:</span>
                      <span className="font-bold text-rose-600 text-sm">
                        {formatCurrency(orderDetail.remainingAmount)}
                      </span>
                    </div>
                  </div>

                  {orderDetail.remainingAmount > 0 && orderDetail.status !== 'CANCELLED' && (
                    <button
                      onClick={() => {
                        setPaymentForm({
                          amount: orderDetail.remainingAmount,
                          paymentMethod: 'CASH',
                          paymentType: 'FINAL_PAYMENT',
                          notes: `Thu nốt đơn hàng ${orderDetail.code}`,
                        });
                        setIsPaymentModalOpen(true);
                      }}
                      className="w-full py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-xl font-semibold text-xs shadow-sm"
                    >
                      + Ghi nhận thu tiền ({formatCurrency(orderDetail.remainingAmount)})
                    </button>
                  )}
                </div>
              </div>

              {/* Payments History */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-forest-900">Lịch sử thu tiền & phiếu thu</h4>
                </div>
                <div className="divide-y divide-sage-100 border border-sage-200 rounded-2xl overflow-hidden">
                  {orderDetail.payments.length === 0 ? (
                    <div className="p-3 text-xs text-forest-400 italic text-center">Chưa có giao dịch thanh toán nào.</div>
                  ) : (
                    orderDetail.payments.map((p) => (
                      <div key={p.id} className="p-3 text-xs flex items-center justify-between hover:bg-cream-50">
                        <div>
                          <div className="font-mono font-bold text-sage-800">{p.code}</div>
                          <div className="text-[10px] text-forest-400">
                            {formatDateTime(p.paymentDate)} • {p.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'} • Thu bởi {p.collectedBy.fullName}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-700">{formatCurrency(p.amount)}</div>
                          <div className="text-[10px] text-forest-500">{p.notes}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 7. MODAL THU TIỀN BỔ SUNG                  */}
      {/* ========================================== */}
      {isPaymentModalOpen && orderDetail && (
        <div className="fixed inset-0 bg-forest-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-sage-200 shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-sage-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <h3 className="font-serif font-bold text-lg text-forest-900">
                  Ghi Nhận Thu Tiền
                </h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-2 text-forest-400 hover:text-forest-700 rounded-xl hover:bg-cream-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addPaymentMutation.mutate({
                  orderId: orderDetail.id,
                  payload: {
                    amount: Number(paymentForm.amount),
                    paymentMethod: paymentForm.paymentMethod,
                    paymentType: paymentForm.paymentType,
                    notes: paymentForm.notes.trim() || undefined,
                  },
                });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">
                  Số tiền thu (VNĐ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-sm font-bold text-forest-900 focus:outline-none focus:ring-2 focus:ring-sage-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">Phương thức</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 bg-cream-50 border border-sage-300 rounded-xl text-xs"
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="BANK_TRANSFER">Chuyển khoản</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest-700 mb-1">Loại thu</label>
                  <select
                    value={paymentForm.paymentType}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentType: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 bg-cream-50 border border-sage-300 rounded-xl text-xs"
                  >
                    <option value="FINAL_PAYMENT">Thanh toán cuối</option>
                    <option value="DEPOSIT">Tiền cọc bổ sung</option>
                    <option value="FULL_PAYMENT">Toàn bộ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-forest-700 mb-1">Ghi chú phiếu thu</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-sage-200">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-sage-300 text-forest-700 hover:bg-cream-100 font-medium text-sm transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={addPaymentMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition shadow-sm disabled:opacity-50"
                >
                  {addPaymentMutation.isPending ? 'Đang lưu...' : 'Xác nhận thu tiền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
