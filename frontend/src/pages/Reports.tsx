import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import {
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  Download,
  Award,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface PnLKpis {
  completedOrdersCount: number;
  grossRevenue: number;
  totalDiscount: number;
  netRevenue: number;
  shippingCollected: number;
  shippingCostPaid: number;
  totalCogs: number;
  grossProfit: number;
  grossProfitMargin: number;
  totalOpex: number;
  totalOtherIncome: number;
  netProfit: number;
  netProfitMargin: number;
}

interface OpexBreakdownItem {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
}

interface TopProductItem {
  id: string;
  sku: string;
  name: string;
  categoryName: string;
  quantitySold: number;
  revenue: number;
  cogs: number;
  profit: number;
}

interface TimeseriesItem {
  label: string;
  date: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  netProfit: number;
}

interface PnLReportData {
  period: {
    startDate: string;
    endDate: string;
  };
  kpis: PnLKpis;
  opexBreakdown: OpexBreakdownItem[];
  topProducts: TopProductItem[];
  timeseries: TimeseriesItem[];
}

const PIE_COLORS = [
  '#059669', // Emerald
  '#0284c7', // Sky
  '#d97706', // Amber
  '#e11d48', // Rose
  '#7c3aed', // Violet
  '#0d9488', // Teal
  '#ea580c', // Orange
  '#475569', // Slate
];

export const ReportsPage: React.FC = () => {
  // Preset date filter
  const [datePreset, setDatePreset] = useState<'today' | '7days' | 'month' | 'last_month' | 'quarter' | 'year' | 'custom'>('month');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

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
    } else if (datePreset === 'quarter') {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), quarterMonth, 1);
      const end = new Date(now.getFullYear(), quarterMonth + 3, 0);
      setFromDate(start.toISOString().split('T')[0]);
      setToDate(end.toISOString().split('T')[0]);
    } else if (datePreset === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      setFromDate(start.toISOString().split('T')[0]);
      setToDate(end.toISOString().split('T')[0]);
    }
  }, [datePreset]);

  // Fetch Report Data
  const { data: reportData, isLoading } = useQuery<PnLReportData>({
    queryKey: ['reports-pnl', fromDate, toDate],
    queryFn: async () => {
      const params: any = {};
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const res = await api.get('/reports/profit-and-loss', { params });
      return res.data?.data;
    },
  });

  const handleExportExcel = () => {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);

    const url = `http://localhost:5000/api/v1/reports/profit-and-loss/export?${params.toString()}`;
    window.open(url, '_blank');
  };

  const kpis = reportData?.kpis || {
    completedOrdersCount: 0,
    grossRevenue: 0,
    totalDiscount: 0,
    netRevenue: 0,
    shippingCollected: 0,
    shippingCostPaid: 0,
    totalCogs: 0,
    grossProfit: 0,
    grossProfitMargin: 0,
    totalOpex: 0,
    totalOtherIncome: 0,
    netProfit: 0,
    netProfitMargin: 0,
  };

  const timeseries = reportData?.timeseries || [];
  const opexBreakdown = reportData?.opexBreakdown || [];
  const topProducts = reportData?.topProducts || [];

  return (
    <div className="space-y-6">
      {/* 1. Header & Filter Presets */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-forest-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
            Báo Cáo Doanh Thu & Lợi Nhuận (P&L)
          </h1>
          <p className="text-sm text-forest-600 mt-1">
            Phân tích chi tiết hiệu quả kinh doanh, giá vốn theo phương pháp bình quân gia quyền di động (MWAC) và lợi nhuận ròng
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-medium shadow-sm transition-all"
          >
            <Download className="w-4 h-4" /> Xuất Báo Cáo Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* 2. Date Filter Toolbar */}
      <div className="p-3 bg-white rounded-3xl border border-sage-200 shadow-sm flex flex-wrap items-center gap-2">
        <div className="flex items-center p-1 bg-cream-50 rounded-2xl border border-sage-200 text-xs font-medium">
          <button
            onClick={() => setDatePreset('today')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              datePreset === 'today' ? 'bg-white shadow-sm text-forest-900 font-bold' : 'text-forest-600'
            }`}
          >
            Hôm nay
          </button>
          <button
            onClick={() => setDatePreset('7days')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              datePreset === '7days' ? 'bg-white shadow-sm text-forest-900 font-bold' : 'text-forest-600'
            }`}
          >
            7 ngày qua
          </button>
          <button
            onClick={() => setDatePreset('month')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              datePreset === 'month' ? 'bg-white shadow-sm text-forest-900 font-bold' : 'text-forest-600'
            }`}
          >
            Tháng này
          </button>
          <button
            onClick={() => setDatePreset('last_month')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              datePreset === 'last_month' ? 'bg-white shadow-sm text-forest-900 font-bold' : 'text-forest-600'
            }`}
          >
            Tháng trước
          </button>
          <button
            onClick={() => setDatePreset('quarter')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              datePreset === 'quarter' ? 'bg-white shadow-sm text-forest-900 font-bold' : 'text-forest-600'
            }`}
          >
            Quý này
          </button>
          <button
            onClick={() => setDatePreset('year')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              datePreset === 'year' ? 'bg-white shadow-sm text-forest-900 font-bold' : 'text-forest-600'
            }`}
          >
            Năm nay
          </button>
          <button
            onClick={() => setDatePreset('custom')}
            className={`px-3 py-1.5 rounded-xl transition-all ${
              datePreset === 'custom' ? 'bg-white shadow-sm text-forest-900 font-bold' : 'text-forest-600'
            }`}
          >
            Tùy chọn
          </button>
        </div>

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

      {/* 3. Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Doanh thu thuần */}
        <div className="p-4 bg-white rounded-3xl border border-sage-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-forest-600 uppercase tracking-wider">
              Doanh Thu Thuần
            </span>
            <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-forest-900 mt-2 font-mono">
            {formatCurrency(kpis.netRevenue)}
          </p>
          <div className="mt-2 text-[11px] text-forest-500">
            {kpis.completedOrdersCount} đơn hoàn thành
          </div>
        </div>

        {/* Giá vốn hàng bán (COGS) */}
        <div className="p-4 bg-white rounded-3xl border border-sage-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-forest-600 uppercase tracking-wider">
              Giá Vốn Hàng Bán
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-amber-700 mt-2 font-mono">
            {formatCurrency(kpis.totalCogs)}
          </p>
          <div className="mt-2 text-[11px] text-amber-600">
            Tính theo Moving WAC
          </div>
        </div>

        {/* Lợi nhuận gộp */}
        <div className="p-4 bg-white rounded-3xl border border-sage-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
              Lợi Nhuận Gộp
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-emerald-700 mt-2 font-mono">
            {formatCurrency(kpis.grossProfit)}
          </p>
          <div className="mt-2 text-[11px] text-emerald-600 font-semibold">
            Biên gộp: {kpis.grossProfitMargin}%
          </div>
        </div>

        {/* Chi phí vận hành (OPEX) */}
        <div className="p-4 bg-white rounded-3xl border border-sage-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
              Chi Phí Vận Hành
            </span>
            <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-rose-600 mt-2 font-mono">
            {formatCurrency(kpis.totalOpex)}
          </p>
          <div className="mt-2 text-[11px] text-rose-500">
            {opexBreakdown.length} nhóm chi phí
          </div>
        </div>

        {/* Lợi nhuận ròng */}
        <div className="p-4 bg-gradient-to-br from-emerald-800 to-emerald-900 text-white rounded-3xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-200 uppercase tracking-wider">
              Lợi Nhuận Ròng
            </span>
            <Sparkles className="w-4 h-4 text-emerald-300" />
          </div>
          <p className="text-xl font-bold mt-2 font-mono text-white">
            {formatCurrency(kpis.netProfit)}
          </p>
          <div className="mt-2 text-[11px] text-emerald-200 font-semibold">
            Biên ròng: {kpis.netProfitMargin}%
          </div>
        </div>
      </div>

      {/* 4. Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composed Bar & Line Chart: Doanh thu, Chi phí, Lợi nhuận */}
        <div className="lg:col-span-2 p-5 bg-white rounded-3xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-forest-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              Diễn Biến Doanh Thu, Chi Phí & Lợi Nhuận
            </h2>
          </div>

          <div className="h-72 w-full text-xs">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-forest-400">
                Đang tổng hợp biểu đồ...
              </div>
            ) : timeseries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-forest-400">
                Không có dữ liệu trong khoảng thời gian này
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeseries}>
                  <XAxis dataKey="label" stroke="#6b7280" fontSize={11} />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={11}
                    tickFormatter={(val) =>
                      val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${val / 1000}k`
                    }
                  />
                  <Tooltip
                    formatter={(val: any) => formatCurrency(Number(val))}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1px solid #e5e7eb',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="revenue" name="Doanh thu thuần" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="cogs" name="Giá vốn (COGS)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="opex" name="Chi phí vận hành" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="netProfit"
                    name="Lợi nhuận ròng"
                    stroke="#047857"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie Chart: Cơ cấu chi phí vận hành */}
        <div className="p-5 bg-white rounded-3xl border border-sage-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-forest-900 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-emerald-600" />
              Cơ Cấu Chi Phí Vận Hành
            </h2>
          </div>

          <div className="h-56 w-full text-xs">
            {isLoading || opexBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-forest-400">
                Chưa có dữ liệu chi phí vận hành trong kỳ
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={opexBreakdown}
                    dataKey="amount"
                    nameKey="categoryName"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={40}
                    paddingAngle={3}
                  >
                    {opexBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => formatCurrency(Number(val))}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legend items */}
          <div className="space-y-1.5 mt-2 max-h-32 overflow-y-auto pr-1">
            {opexBreakdown.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs text-forest-700">
                <span className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="truncate">{item.categoryName}</span>
                </span>
                <span className="font-mono font-medium ml-2 text-forest-900">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Income Statement (Báo Cáo Kết Quả Kinh Doanh) & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P&L Statement Table */}
        <div className="p-5 bg-white rounded-3xl border border-sage-200 shadow-sm space-y-4">
          <h2 className="text-base font-serif font-bold text-forest-900">
            Báo Cáo Kết Quả Hoạt Động Kinh Doanh
          </h2>

          <div className="border border-sage-100 rounded-2xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-cream-50 text-forest-600 uppercase text-[11px] font-semibold border-b border-sage-200">
                <tr>
                  <th className="px-4 py-3">Khoản Mục Tài Chính</th>
                  <th className="px-4 py-3 text-right">Số Tiền (VND)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-100 text-forest-800">
                <tr className="bg-cream-50/30">
                  <td className="px-4 py-2.5 font-bold text-forest-900">
                    I. Doanh thu bán hàng gộp
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold">
                    {formatCurrency(kpis.grossRevenue)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-forest-600 pl-8">
                    - Chiết khấu giảm giá đơn hàng
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-rose-600">
                    -{formatCurrency(kpis.totalDiscount)}
                  </td>
                </tr>
                <tr className="bg-blue-50/40">
                  <td className="px-4 py-2.5 font-bold text-blue-900">
                    II. Doanh thu bán hàng thuần
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-900">
                    {formatCurrency(kpis.netRevenue)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-bold text-amber-900">
                    III. Giá vốn hàng bán (COGS - Moving WAC)
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-700">
                    -{formatCurrency(kpis.totalCogs)}
                  </td>
                </tr>
                <tr className="bg-emerald-50/60 font-bold text-emerald-900">
                  <td className="px-4 py-2.5">
                    IV. LỢI NHUẬN GỘP (Biên gộp: {kpis.grossProfitMargin}%)
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {formatCurrency(kpis.grossProfit)}
                  </td>
                </tr>
                <tr className="bg-rose-50/30">
                  <td className="px-4 py-2.5 font-bold text-rose-900">
                    V. Chi phí vận hành kinh doanh (OPEX)
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-600">
                    -{formatCurrency(kpis.totalOpex)}
                  </td>
                </tr>
                {opexBreakdown.map((op, idx) => (
                  <tr key={idx} className="text-forest-600">
                    <td className="px-4 py-1.5 pl-8 text-[11px]">+ {op.categoryName}</td>
                    <td className="px-4 py-1.5 text-right font-mono text-[11px]">
                      -{formatCurrency(op.amount)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-2 text-forest-700 pl-4 font-medium">
                    VI. Thu nhập khác (Thanh lý, hỗ trợ...)
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-700">
                    +{formatCurrency(kpis.totalOtherIncome)}
                  </td>
                </tr>
                <tr className="bg-forest-900 text-white font-bold text-sm">
                  <td className="px-4 py-3">
                    VII. LỢI NHUẬN RÒNG (Biên ròng: {kpis.netProfitMargin}%)
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-300 text-base">
                    {formatCurrency(kpis.netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 Best-Selling Products */}
        <div className="p-5 bg-white rounded-3xl border border-sage-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-serif font-bold text-forest-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Top Sản Phẩm Mang Lại Doanh Thu Cao Nhất
            </h2>
            <span className="text-xs text-forest-500">Xếp theo doanh thu</span>
          </div>

          <div className="border border-sage-100 rounded-2xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-cream-50 text-forest-600 uppercase text-[11px] font-semibold border-b border-sage-200">
                <tr>
                  <th className="px-3 py-2.5">Sản phẩm</th>
                  <th className="px-3 py-2.5 text-center">Đã bán</th>
                  <th className="px-3 py-2.5 text-right">Doanh thu</th>
                  <th className="px-3 py-2.5 text-right">Lợi nhuận gộp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-100 text-forest-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-forest-400">
                      Đang phân tích sản phẩm...
                    </td>
                  </tr>
                ) : topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-forest-400">
                      Chưa có dữ liệu bán hàng trong kỳ
                    </td>
                  </tr>
                ) : (
                  topProducts.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-cream-50/50">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                              idx === 0
                                ? 'bg-amber-100 text-amber-800'
                                : idx === 1
                                ? 'bg-slate-200 text-slate-800'
                                : idx === 2
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <span className="font-semibold text-forest-900 block truncate max-w-[160px]">
                              {p.name}
                            </span>
                            <span className="text-[10px] text-forest-400 font-mono">
                              [{p.sku}]
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-medium">
                        {p.quantitySold}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-forest-900">
                        {formatCurrency(p.revenue)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">
                        +{formatCurrency(p.profit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
