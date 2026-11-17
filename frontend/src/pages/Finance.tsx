import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/format';
import {
  DollarSign,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Building2,
  Calendar,
  Search,
  Download,
  X,
  AlertCircle,
} from 'lucide-react';
import { getSocket } from '../services/socket';

interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface FinancialTransaction {
  id: string;
  code: string;
  flowType: 'INFLOW' | 'OUTFLOW';
  categoryId?: string | null;
  category?: ExpenseCategory | null;
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  amount: number;
  performedById: string;
  performedBy: {
    id: string;
    fullName: string;
    username: string;
  };
  sourceOrderId?: string | null;
  sourceOrder?: {
    id: string;
    code: string;
    totalAmount: number;
  } | null;
  sourcePurchaseId?: string | null;
  sourcePurchase?: {
    id: string;
    code: string;
    totalAmount: number;
  } | null;
  paymentId?: string | null;
  payment?: {
    id: string;
    code: string;
    paymentType: string;
  } | null;
  transactionDate: string;
  description: string;
  createdAt: string;
}

interface FinanceSummary {
  openingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  closingBalance: number;
  cashFund: {
    inflow: number;
    outflow: number;
    net: number;
  };
  bankFund: {
    inflow: number;
    outflow: number;
    net: number;
  };
}

export const FinancePage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filter states
  const [flowTypeFilter, setFlowTypeFilter] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'today' | '7days' | 'month' | 'last_month' | 'custom'>('month');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<FinancialTransaction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state for creating transaction
  const [formData, setFormData] = useState<{
    flowType: 'INFLOW' | 'OUTFLOW';
    amount: number;
    categoryId: string;
    paymentMethod: 'CASH' | 'BANK_TRANSFER';
    transactionDate: string;
    description: string;
  }>({
    flowType: 'OUTFLOW',
    amount: 0,
    categoryId: '',
    paymentMethod: 'CASH',
    transactionDate: new Date().toISOString().slice(0, 16),
    description: '',
  });

  // Calculate default dates based on preset
  useEffect(() => {
    const now = new Date();
    if (datePreset === 'today') {
      const d = now.toISOString().split('T')[0];
      setFromDate(d);
      setToDate(d);
    } else if (datePreset === '7days') {
      const past = new Date(now.getTime() - 7 * 86400000);
      setFromDate(past.toISOString().split('T')[0]);
      setToDate(now.toISOString().split('T')[0]);
    } else if (datePreset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFromDate(start.toISOString().split('T')[0]);
      setToDate(end.toISOString().split('T')[0]);
    } else if (datePreset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(start.toISOString().split('T')[0]);
      setToDate(end.toISOString().split('T')[0]);
    }
  }, [datePreset]);

  // Real-time synchronization via WebSocket
  useEffect(() => {
    const socket = getSocket();

    const handleFinanceUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['reports-pnl'] });
    };

    socket.on('FINANCE_UPDATED', handleFinanceUpdated);

    return () => {
      socket.off('FINANCE_UPDATED', handleFinanceUpdated);
    };
  }, [queryClient]);

  // 1. Fetch Categories
  const { data: categories = [] } = useQuery<ExpenseCategory[]>({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const res = await api.get('/expense-categories');
      return res.data?.data || [];
    },
  });

  // 2. Fetch Transactions & Summary
  const { data: financeData, isLoading } = useQuery<{
    summary: FinanceSummary;
    items: FinancialTransaction[];
    pagination: any;
  }>({
    queryKey: [
      'financial-transactions',
      flowTypeFilter,
      methodFilter,
      categoryFilter,
      fromDate,
      toDate,
      searchTerm,
    ],
    queryFn: async () => {
      const params: any = {};
      if (flowTypeFilter) params.flowType = flowTypeFilter;
      if (methodFilter) params.paymentMethod = methodFilter;
      if (categoryFilter) params.categoryId = categoryFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get('/finance/transactions', { params });
      return res.data?.data;
    },
  });

  // 3. Create Transaction Mutation
  const createTxMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const res = await api.post('/finance/transactions', {
        flowType: payload.flowType,
        amount: Number(payload.amount),
        categoryId: payload.categoryId || null,
        paymentMethod: payload.paymentMethod,
        transactionDate: payload.transactionDate ? new Date(payload.transactionDate).toISOString() : undefined,
        description: payload.description,
      });
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      setIsModalOpen(false);
      setFormError(null);
      setFormData({
        flowType: 'OUTFLOW',
        amount: 0,
        categoryId: '',
        paymentMethod: 'CASH',
        transactionDate: new Date().toISOString().slice(0, 16),
        description: '',
      });
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Có lỗi xảy ra khi tạo phiếu thu/chi');
    },
  });

  const handleOpenCreateModal = (type: 'INFLOW' | 'OUTFLOW') => {
    setFormData({
      flowType: type,
      amount: 0,
      categoryId: '',
      paymentMethod: 'CASH',
      transactionDate: new Date().toISOString().slice(0, 16),
      description: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (flowTypeFilter) params.append('flowType', flowTypeFilter);
      if (methodFilter) params.append('paymentMethod', methodFilter);
      if (categoryFilter) params.append('categoryId', categoryFilter);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (searchTerm) params.append('search', searchTerm);

      const url = `http://localhost:5000/api/v1/finance/transactions/export?${params.toString()}`;
      window.open(url, '_blank');
    } catch (e) {
      console.error(e);
    }
  };

  const summary = financeData?.summary || {
    openingBalance: 0,
    totalInflow: 0,
    totalOutflow: 0,
    netCashFlow: 0,
    closingBalance: 0,
    cashFund: { inflow: 0, outflow: 0, net: 0 },
    bankFund: { inflow: 0, outflow: 0, net: 0 },
  };

  const transactions = financeData?.items || [];

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-forest-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-600" />
            Sổ Quỹ Thu Chi
          </h1>
          <p className="text-sm text-forest-600 mt-1">
            Quản lý dòng tiền vào/ra, quỹ tiền mặt, tài khoản ngân hàng và kiểm soát thu chi thực tế
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleOpenCreateModal('INFLOW')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-medium shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Lập Phiếu Thu
          </button>
          <button
            onClick={() => handleOpenCreateModal('OUTFLOW')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-sm font-medium shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Lập Phiếu Chi
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-sage-200 hover:bg-sage-50 text-forest-700 rounded-2xl text-sm font-medium transition-all shadow-sm"
            title="Xuất file Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tổng Thu */}
        <div className="p-5 bg-white rounded-3xl border border-sage-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Tổng Thu Trong Kỳ
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-3 font-mono">
            +{formatCurrency(summary.totalInflow)}
          </p>
          <div className="mt-2 text-xs text-forest-500 flex items-center justify-between">
            <span>Tiền mặt: {formatCurrency(summary.cashFund.inflow)}</span>
            <span>Ngân hàng: {formatCurrency(summary.bankFund.inflow)}</span>
          </div>
        </div>

        {/* Tổng Chi */}
        <div className="p-5 bg-white rounded-3xl border border-sage-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
              Tổng Chi Trong Kỳ
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-3 font-mono">
            -{formatCurrency(summary.totalOutflow)}
          </p>
          <div className="mt-2 text-xs text-forest-500 flex items-center justify-between">
            <span>Tiền mặt: {formatCurrency(summary.cashFund.outflow)}</span>
            <span>Ngân hàng: {formatCurrency(summary.bankFund.outflow)}</span>
          </div>
        </div>

        {/* Dòng Tiền Ròng (Net Cashflow) */}
        <div className="p-5 bg-white rounded-3xl border border-sage-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-forest-700 uppercase tracking-wider">
              Dòng Tiền Ròng (Thu - Chi)
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                summary.netCashFlow >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p
            className={`text-2xl font-bold mt-3 font-mono ${
              summary.netCashFlow >= 0 ? 'text-emerald-800' : 'text-rose-600'
            }`}
          >
            {summary.netCashFlow >= 0 ? '+' : ''}
            {formatCurrency(summary.netCashFlow)}
          </p>
          <div className="mt-2 text-xs text-forest-500 flex items-center justify-between">
            <span>Đầu kỳ: {formatCurrency(summary.openingBalance)}</span>
            <span>Cuối kỳ: {formatCurrency(summary.closingBalance)}</span>
          </div>
        </div>

        {/* Quỹ Tồn (Tiền mặt & Ngân hàng) */}
        <div className="p-5 bg-gradient-to-br from-forest-800 to-forest-900 text-white rounded-3xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
              Số Dư Quỹ Thực Tế
            </span>
            <Wallet className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold mt-3 font-mono text-emerald-100">
            {formatCurrency(summary.closingBalance)}
          </p>
          <div className="mt-2 pt-2 border-t border-forest-700/60 text-xs text-forest-200 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Wallet className="w-3 h-3 text-amber-300" /> TM: {formatCurrency(summary.cashFund.net)}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3 text-sky-300" /> NH: {formatCurrency(summary.bankFund.net)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filters & Search Toolbar */}
      <div className="p-4 bg-white rounded-3xl border border-sage-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center p-1 bg-cream-50 rounded-2xl border border-sage-200 text-xs font-medium">
            <button
              onClick={() => setDatePreset('today')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                datePreset === 'today' ? 'bg-white shadow-sm text-forest-900 font-bold' : 'text-forest-600 hover:text-forest-900'
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setDatePreset('7days')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                datePreset === '7days' ? 'bg-white shadow-sm text-forest-900 font-bold' : 'text-forest-600 hover:text-forest-900'
              }`}
            >
              7 ngày qua
            </button>
            <button
              onClick={() => setDatePreset('month')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                datePreset === 'month' ? 'bg-white shadow-sm text-forest-900 font-bold' : 'text-forest-600 hover:text-forest-900'
              }`}
            >
              Tháng này
            </button>
            <button
              onClick={() => setDatePreset('last_month')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                datePreset === 'last_month' ? 'bg-white shadow-sm text-forest-900 font-bold' : 'text-forest-600 hover:text-forest-900'
              }`}
            >
              Tháng trước
            </button>
            <button
              onClick={() => setDatePreset('custom')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                datePreset === 'custom' ? 'bg-white shadow-sm text-forest-900 font-bold' : 'text-forest-600 hover:text-forest-900'
              }`}
            >
              Tùy chọn
            </button>
          </div>

          {/* Custom Date Pickers */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cream-50 rounded-xl border border-sage-200">
                <Calendar className="w-3.5 h-3.5 text-forest-500" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent text-xs text-forest-800 focus:outline-none"
                />
              </div>
              <span className="text-forest-400">đến</span>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-cream-50 rounded-xl border border-sage-200">
                <Calendar className="w-3.5 h-3.5 text-forest-500" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent text-xs text-forest-800 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Detailed Secondary Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-sage-100">
          {/* Search box */}
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="w-4 h-4 text-forest-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm mã phiếu SQ, nội dung diễn giải..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-cream-50/50 border border-sage-200 rounded-xl text-xs text-forest-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
            />
          </div>

          {/* FlowType Filter */}
          <select
            value={flowTypeFilter}
            onChange={(e) => setFlowTypeFilter(e.target.value)}
            className="w-full sm:w-36 px-3 py-2 bg-white border border-sage-200 rounded-xl text-xs text-forest-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Tất cả dòng tiền</option>
            <option value="INFLOW">Dòng tiền vào (Thu)</option>
            <option value="OUTFLOW">Dòng tiền ra (Chi)</option>
          </select>

          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="w-full sm:w-36 px-3 py-2 bg-white border border-sage-200 rounded-xl text-xs text-forest-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Tất cả hình thức</option>
            <option value="CASH">Tiền mặt</option>
            <option value="BANK_TRANSFER">Chuyển khoản</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-44 px-3 py-2 bg-white border border-sage-200 rounded-xl text-xs text-forest-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Transactions Table */}
      <div className="bg-white rounded-3xl border border-sage-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-forest-800">
            <thead className="bg-cream-50/70 border-b border-sage-200 text-forest-600 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Mã phiếu</th>
                <th className="px-4 py-3.5">Thời gian</th>
                <th className="px-4 py-3.5">Phân loại</th>
                <th className="px-4 py-3.5">Danh mục</th>
                <th className="px-4 py-3.5">Phương thức</th>
                <th className="px-4 py-3.5 text-right">Số tiền</th>
                <th className="px-4 py-3.5">Người lập</th>
                <th className="px-4 py-3.5">Diễn giải</th>
                <th className="px-4 py-3.5 text-center">Tham chiếu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-forest-400">
                    Đang tải sổ quỹ thu chi...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-forest-400">
                    Không có giao dịch thu chi nào phù hợp với bộ lọc
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isInflow = tx.flowType === 'INFLOW';
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-cream-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono font-medium text-forest-900">
                        {tx.code}
                      </td>
                      <td className="px-4 py-3.5 text-forest-600 whitespace-nowrap">
                        {formatDateTime(tx.transactionDate)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            isInflow
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isInflow ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3" /> Thu tiền
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3" /> Chi tiền
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-forest-900">
                        {tx.category?.name || 'Khác / Chưa phân loại'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-[11px] text-forest-700">
                          {tx.paymentMethod === 'CASH' ? (
                            <>
                              <Wallet className="w-3.5 h-3.5 text-amber-600" /> Tiền mặt
                            </>
                          ) : (
                            <>
                              <Building2 className="w-3.5 h-3.5 text-sky-600" /> Chuyển khoản
                            </>
                          )}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3.5 text-right font-mono font-bold text-sm ${
                          isInflow ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {isInflow ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-4 py-3.5 text-forest-700">
                        {tx.performedBy?.fullName || tx.performedBy?.username}
                      </td>
                      <td className="px-4 py-3.5 text-forest-600 max-w-xs truncate" title={tx.description}>
                        {tx.description}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {tx.sourceOrder && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-mono text-[10px] border border-blue-200">
                            Đơn: {tx.sourceOrder.code}
                          </span>
                        )}
                        {tx.sourcePurchase && (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md font-mono text-[10px] border border-purple-200">
                            Nhập: {tx.sourcePurchase.code}
                          </span>
                        )}
                        {!tx.sourceOrder && !tx.sourcePurchase && (
                          <span className="text-forest-400 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Create Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-sage-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-sage-100">
              <h2 className="text-lg font-serif font-bold text-forest-900 flex items-center gap-2">
                {formData.flowType === 'INFLOW' ? (
                  <>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                    Lập Phiếu Thu Tiền
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    Lập Phiếu Chi Tiền
                  </>
                )}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl hover:bg-cream-100 text-forest-400 hover:text-forest-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTxMutation.mutate(formData);
              }}
              className="space-y-4 text-xs"
            >
              {/* Loại giao dịch */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, flowType: 'INFLOW' })}
                  className={`flex-1 py-2 rounded-xl font-medium border transition-all ${
                    formData.flowType === 'INFLOW'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                      : 'border-sage-200 text-forest-600 hover:bg-sage-50'
                  }`}
                >
                  Thu Tiền (Dòng vào)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, flowType: 'OUTFLOW' })}
                  className={`flex-1 py-2 rounded-xl font-medium border transition-all ${
                    formData.flowType === 'OUTFLOW'
                      ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-sm'
                      : 'border-sage-200 text-forest-600 hover:bg-sage-50'
                  }`}
                >
                  Chi Tiền (Dòng ra)
                </button>
              </div>

              {/* Số tiền */}
              <div>
                <label className="block text-forest-700 font-medium mb-1">
                  Số tiền (VND) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="Nhập số tiền..."
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl font-mono text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  required
                />
                {formData.amount > 0 && (
                  <p className="text-[11px] text-emerald-700 font-mono mt-1 font-semibold">
                    Bằng chữ / Quy đổi: {formatCurrency(formData.amount)}
                  </p>
                )}
              </div>

              {/* Danh mục & Phương thức */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-forest-700 font-medium mb-1">
                    Danh mục chi phí <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-sage-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-forest-700 font-medium mb-1">
                    Phương thức thanh toán <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        paymentMethod: e.target.value as 'CASH' | 'BANK_TRANSFER',
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-sage-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="CASH">Tiền mặt (Quỹ quầy)</option>
                    <option value="BANK_TRANSFER">Chuyển khoản (Ngân hàng)</option>
                  </select>
                </div>
              </div>

              {/* Ngày giao dịch */}
              <div>
                <label className="block text-forest-700 font-medium mb-1">Thời gian phát sinh</label>
                <input
                  type="datetime-local"
                  value={formData.transactionDate}
                  onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl focus:outline-none"
                />
              </div>

              {/* Diễn giải */}
              <div>
                <label className="block text-forest-700 font-medium mb-1">
                  Nội dung diễn giải chi tiết <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="VD: Trả tiền thuê mặt bằng tháng 11, mua vật dụng văn phòng..."
                  className="w-full px-3 py-2 bg-cream-50 border border-sage-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-sage-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-sage-200 text-forest-600 rounded-xl hover:bg-sage-50 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createTxMutation.isPending}
                  className={`px-5 py-2 text-white font-medium rounded-xl shadow-sm transition-all ${
                    formData.flowType === 'INFLOW'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {createTxMutation.isPending ? 'Đang lưu...' : 'Xác Nhận Lưu Phiếu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Transaction Detail Slide-over / Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-sage-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-sage-100">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-800">{selectedTx.code}</span>
                <h3 className="text-base font-serif font-bold text-forest-900 mt-0.5">
                  Chi Tiết Phiếu {selectedTx.flowType === 'INFLOW' ? 'Thu' : 'Chi'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1 rounded-xl hover:bg-cream-100 text-forest-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-cream-50 rounded-2xl border border-sage-200 text-center">
                <span className="text-[11px] text-forest-500 uppercase tracking-wider block">
                  Số tiền giao dịch
                </span>
                <span
                  className={`text-2xl font-mono font-bold block mt-1 ${
                    selectedTx.flowType === 'INFLOW' ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {selectedTx.flowType === 'INFLOW' ? '+' : '-'}
                  {formatCurrency(selectedTx.amount)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-forest-700">
                <div className="p-2.5 bg-white border border-sage-100 rounded-xl">
                  <span className="text-[10px] text-forest-400 block">Danh mục</span>
                  <span className="font-medium">{selectedTx.category?.name || 'Khác'}</span>
                </div>
                <div className="p-2.5 bg-white border border-sage-100 rounded-xl">
                  <span className="text-[10px] text-forest-400 block">Hình thức</span>
                  <span className="font-medium">
                    {selectedTx.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-sage-100 rounded-xl">
                  <span className="text-[10px] text-forest-400 block">Thời gian</span>
                  <span className="font-medium">{formatDateTime(selectedTx.transactionDate)}</span>
                </div>
                <div className="p-2.5 bg-white border border-sage-100 rounded-xl">
                  <span className="text-[10px] text-forest-400 block">Người thực hiện</span>
                  <span className="font-medium">
                    {selectedTx.performedBy?.fullName || selectedTx.performedBy?.username}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-white border border-sage-100 rounded-xl">
                <span className="text-[10px] text-forest-400 block">Nội dung diễn giải</span>
                <p className="font-medium text-forest-900 mt-0.5">{selectedTx.description}</p>
              </div>

              {selectedTx.sourceOrder && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900">
                  <span className="text-[10px] text-blue-600 block font-semibold uppercase">
                    Liên kết đơn hàng
                  </span>
                  <p className="font-mono font-bold mt-0.5">{selectedTx.sourceOrder.code}</p>
                </div>
              )}

              {selectedTx.sourcePurchase && (
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-purple-900">
                  <span className="text-[10px] text-purple-600 block font-semibold uppercase">
                    Liên kết phiếu nhập kho
                  </span>
                  <p className="font-mono font-bold mt-0.5">{selectedTx.sourcePurchase.code}</p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-sage-100 flex justify-end">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-1.5 bg-forest-800 text-white rounded-xl text-xs font-medium hover:bg-forest-900"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
