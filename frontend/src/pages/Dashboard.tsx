import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SessionsModal } from '../components/auth/SessionsModal';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import { 
  Sparkles, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  Boxes, 
  BadgeDollarSign, 
  TrendingUp, 
  Globe, 
  ArrowUpRight,
  ArrowRight,
  CircleDollarSign,
  BarChart3,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);
  const isAdmin = user?.roleId === 'ADMIN';

  // 1. Fetch Orders for live status count
  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ['dashboard-orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data?.data || [];
    },
  });

  // 2. Fetch P&L today if Admin
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: todayPnl } = useQuery<any>({
    queryKey: ['dashboard-today-pnl', todayStr],
    queryFn: async () => {
      const res = await api.get('/reports/profit-and-loss', {
        params: { fromDate: todayStr, toDate: todayStr },
      });
      return res.data?.data;
    },
    enabled: isAdmin,
  });

  // 3. Fetch Products for available finished stock
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ['dashboard-products'],
    queryFn: async () => {
      const res = await api.get('/products');
      return res.data?.data || [];
    },
  });

  // Calculate live statistics
  const pendingCount = orders.filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED').length;
  const processingCount = orders.filter((o) => o.status === 'PROCESSING' || o.status === 'READY' || o.status === 'SHIPPING').length;
  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;

  const totalAvailableStock = products.reduce(
    (sum, p) => sum + (p.inventory?.availableQuantity || 0),
    0
  );
  const totalReservedStock = products.reduce(
    (sum, p) => sum + (p.inventory?.reservedQuantity || 0),
    0
  );

  const todayRevenue = todayPnl?.kpis?.netRevenue || 0;
  const todayGrossProfit = todayPnl?.kpis?.grossProfit || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Hero Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-cream-100 via-white to-sage-50 border border-sage-200/80 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-sage-100 text-sage-800 border border-sage-200">
            <Sparkles className="w-3.5 h-3.5 text-rose-500" />
            <span>{isAdmin ? 'Chế độ Quản trị Toàn quyền (Admin)' : 'Chế độ Nhân viên Bán hàng (Staff)'}</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-forest-900">
            Xin chào, {user?.fullName}!
          </h2>
          <p className="text-xs sm:text-sm text-forest-600 max-w-xl">
            {isAdmin
              ? 'Hệ thống quản lý First Bloom hoạt động theo cơ sở dữ liệu tập trung PostgreSQL, bảo đảm đồng bộ thời gian thực đa thiết bị, tính giá vốn MWAC và kiểm soát sổ quỹ thu chi minh bạch.'
              : 'Bạn đang thao tác với quyền Nhân viên: Được phép quản lý khách hàng, tạo đơn hàng mới, thu tiền cọc và kiểm tra tồn kho thành phẩm có thể bán.'}
          </p>
        </div>

        <button
          onClick={() => setSessionsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-sage-200 text-xs font-semibold text-forest-800 hover:border-sage-400 hover:shadow-sm transition-all self-start sm:self-auto shrink-0"
        >
          <Globe className="w-4 h-4 text-sage-600" />
          <span>Phiên đồng bộ Online</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-forest-400" />
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Doanh thu hôm nay (Admin only) or Đơn hàng mới (Staff) */}
        {isAdmin ? (
          <div
            onClick={() => navigate('/reports')}
            className="p-6 rounded-3xl bg-white border border-sage-200 shadow-sm space-y-3 cursor-pointer hover:border-emerald-300 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-forest-600 uppercase tracking-wider">Doanh thu hôm nay</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <BadgeDollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-serif font-bold text-emerald-800 font-mono">
              {formatCurrency(todayRevenue)}
            </div>
            <p className="text-xs text-forest-500 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lợi nhuận gộp: {formatCurrency(todayGrossProfit)}</span>
            </p>
          </div>
        ) : (
          <div
            onClick={() => navigate('/orders')}
            className="p-6 rounded-3xl bg-white border border-sage-200 shadow-sm space-y-3 cursor-pointer hover:border-sage-400 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-forest-600 uppercase tracking-wider">Đơn chờ xử lý</span>
              <div className="w-9 h-9 rounded-xl bg-sage-100 text-sage-700 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-serif font-bold text-forest-900 font-mono">{pendingCount} đơn</div>
            <p className="text-xs text-forest-500">Chờ xác nhận & chuẩn bị</p>
          </div>
        )}

        {/* Đang chuẩn bị / Sản xuất */}
        <div
          onClick={() => navigate(isAdmin ? '/production' : '/orders')}
          className="p-6 rounded-3xl bg-white border border-sage-200 shadow-sm space-y-3 cursor-pointer hover:border-amber-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-forest-600 uppercase tracking-wider">Đang làm / Giao hàng</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-forest-900 font-mono">{processingCount} đơn</div>
          <p className="text-xs text-amber-700 font-medium">Bó hoa đang hoàn thiện</p>
        </div>

        {/* Đơn hàng hoàn thành */}
        <div
          onClick={() => navigate('/orders')}
          className="p-6 rounded-3xl bg-white border border-sage-200 shadow-sm space-y-3 cursor-pointer hover:border-emerald-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-forest-600 uppercase tracking-wider">Đã giao hoàn tất</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-forest-900 font-mono">{completedCount} đơn</div>
          <p className="text-xs text-forest-500">Đã trừ kho & ghi nhận giá vốn</p>
        </div>

        {/* Tồn kho thành phẩm có sẵn */}
        <div
          onClick={() => navigate('/inventory')}
          className="p-6 rounded-3xl bg-white border border-sage-200 shadow-sm space-y-3 cursor-pointer hover:border-rose-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-forest-600 uppercase tracking-wider">Thành phẩm bán sẵn</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-serif font-bold text-forest-900 font-mono">{totalAvailableStock} bó</div>
          <p className="text-xs text-rose-700 font-medium">{totalReservedStock} bó đang giữ cho đơn</p>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => navigate('/orders')}
          className="p-5 bg-gradient-to-br from-white to-sage-50/50 rounded-3xl border border-sage-200 shadow-sm hover:shadow-md hover:border-sage-400 cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sage-600 text-white flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-forest-900">Tạo Đơn Hàng Mới</h4>
              <p className="text-xs text-forest-500">Giữ chỗ kho và thu tiền cọc</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-forest-400 group-hover:translate-x-1 transition-transform" />
        </div>

        {isAdmin && (
          <div
            onClick={() => navigate('/finance')}
            className="p-5 bg-gradient-to-br from-white to-emerald-50/30 rounded-3xl border border-sage-200 shadow-sm hover:shadow-md hover:border-emerald-300 cursor-pointer transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                <CircleDollarSign className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-forest-900">Sổ Quỹ Thu Chi</h4>
                <p className="text-xs text-forest-500">Lập phiếu thu / chi thủ công</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-forest-400 group-hover:translate-x-1 transition-transform" />
          </div>
        )}

        {isAdmin && (
          <div
            onClick={() => navigate('/reports')}
            className="p-5 bg-gradient-to-br from-white to-blue-50/30 rounded-3xl border border-sage-200 shadow-sm hover:shadow-md hover:border-blue-300 cursor-pointer transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-forest-900">Báo Cáo Doanh Thu & P&L</h4>
                <p className="text-xs text-forest-500">Biểu đồ phân tích và xuất Excel</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-forest-400 group-hover:translate-x-1 transition-transform" />
          </div>
        )}
      </div>

      {/* Multi-device sync guide */}
      <div className="p-6 rounded-3xl bg-white border border-sage-200 shadow-sm space-y-3">
        <h3 className="font-serif text-base font-bold text-forest-900 flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-600" />
          <span>Hệ Thống Đồng Bộ Đa Thiết Bị Thời Gian Thực (Centralized Database)</span>
        </h3>
        <p className="text-xs sm:text-sm text-forest-600 leading-relaxed">
          First Bloom lưu trữ toàn bộ dữ liệu trên cơ sở dữ liệu tập trung PostgreSQL. Khi bạn tạo một đơn hàng, lập phiếu thu chi hay cập nhật kho trên máy tính bàn, các thiết bị khác (Laptop, iPad, Điện thoại) sẽ tự động nhận được thay đổi qua cổng kết nối WebSocket/Socket.IO mà không cần phải tải lại trang.
        </p>
      </div>

      <SessionsModal
        isOpen={sessionsModalOpen}
        onClose={() => setSessionsModalOpen(false)}
      />
    </div>
  );
};
