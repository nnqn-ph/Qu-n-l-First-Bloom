import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { SessionsModal } from '../auth/SessionsModal';
import { 
  Flower2, 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Package, 
  ScrollText, 
  Hammer, 
  Warehouse, 
  Truck, 
  CircleDollarSign, 
  BarChart3, 
  UserCog, 
  LogOut, 
  Globe, 
  Menu, 
  X,
  Wifi,
  Sparkles
} from 'lucide-react';

export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);

  const isAdmin = user?.roleId === 'ADMIN';

  const navItems = [
    // Staff & Admin
    { label: 'Tổng quan', to: '/', icon: LayoutDashboard, adminOnly: false },
    { label: 'Đơn hàng & Bán hàng', to: '/orders', icon: ShoppingBag, adminOnly: false },
    { label: 'Khách hàng', to: '/customers', icon: Users, adminOnly: false },
    { label: 'Sản phẩm hoa', to: '/products', icon: Package, adminOnly: false },
    { label: 'Tồn kho khả dụng', to: '/inventory', icon: Warehouse, adminOnly: false },

    // Admin Only
    { label: 'Công thức BOM', to: '/recipes', icon: ScrollText, adminOnly: true },
    { label: 'Lệnh sản xuất', to: '/production', icon: Hammer, adminOnly: true },
    { label: 'Nguyên vật liệu & Nhập', to: '/materials', icon: Truck, adminOnly: true },
    { label: 'Sổ quỹ Thu chi', to: '/finance', icon: CircleDollarSign, adminOnly: true },
    { label: 'Báo cáo & Lợi nhuận', to: '/reports', icon: BarChart3, adminOnly: true },
    { label: 'Nhân sự & Phân quyền', to: '/users', icon: UserCog, adminOnly: true },
  ].filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1F2B24] flex flex-col md:flex-row font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col bg-white border-r border-sage-200/80 shrink-0 sticky top-0 h-screen z-40">
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-sage-100 bg-cream-50/60">
          <div className="w-10 h-10 rounded-xl bg-sage-600 text-white flex items-center justify-center shadow-md shadow-sage-600/20">
            <Flower2 className="w-6 h-6 text-cream-100" />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-forest-900 leading-none">First Bloom</h1>
            <p className="text-[11px] text-forest-600 mt-0.5">Tiệm Hoa Kẽm Nhung</p>
          </div>
        </div>

        {/* User Role Card */}
        <div className="p-4 mx-4 mt-4 rounded-2xl bg-sage-50/70 border border-sage-200/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sage-600 text-white font-serif font-bold text-sm flex items-center justify-center shadow-sm">
            {user?.fullName.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-forest-900 truncate">{user?.fullName}</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mt-0.5 ${
              isAdmin ? 'bg-rose-100 text-rose-800' : 'bg-cream-200 text-forest-700'
            }`}>
              {isAdmin ? 'Chủ Tiệm (Admin)' : 'Nhân Viên (Staff)'}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-sage-600 text-white shadow-sm shadow-sage-600/20'
                    : 'text-forest-700 hover:bg-cream-100 hover:text-forest-900'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-sage-100 space-y-2 bg-cream-50/30">
          <button
            onClick={() => setSessionsModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-forest-700 hover:bg-sage-100 hover:text-forest-900 transition-colors"
          >
            <Globe className="w-4 h-4 text-sage-600" />
            <span>Quản lý thiết bị online</span>
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-sage-200 bg-white/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl text-forest-700 hover:bg-sage-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-serif font-bold text-lg text-forest-900">First Bloom</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-forest-600">
            <Sparkles className="w-4 h-4 text-rose-500" />
            <span>Hệ thống cơ sở dữ liệu tập trung PostgreSQL • Đồng bộ Realtime</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Socket.IO: Đồng bộ</span>
            </div>

            <button
              onClick={() => setSessionsModalOpen(true)}
              className="p-2 rounded-xl text-forest-700 hover:bg-sage-100 transition-colors relative"
              title="Xem danh sách thiết bị đang đăng nhập"
            >
              <Globe className="w-4 h-4" />
            </button>

            <button
              onClick={logout}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-forest-900/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-white h-full flex flex-col z-10 shadow-2xl">
            <div className="h-16 flex items-center justify-between px-6 border-b border-sage-100 bg-cream-50">
              <span className="font-serif font-bold text-lg text-forest-900">First Bloom</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-forest-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-sage-50 border-b border-sage-100">
              <p className="text-xs font-bold text-forest-900">{user?.fullName}</p>
              <span className="text-[10px] font-semibold text-rose-800">{user?.roleName}</span>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                      isActive ? 'bg-sage-600 text-white' : 'text-forest-700 hover:bg-cream-100'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="p-4 border-t border-sage-100 space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setSessionsModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-forest-700 bg-sage-50 rounded-xl"
              >
                <Globe className="w-4 h-4 text-sage-600" />
                <span>Quản lý thiết bị</span>
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 rounded-xl"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Device Sessions Modal */}
      <SessionsModal
        isOpen={sessionsModalOpen}
        onClose={() => setSessionsModalOpen(false)}
      />
    </div>
  );
};
