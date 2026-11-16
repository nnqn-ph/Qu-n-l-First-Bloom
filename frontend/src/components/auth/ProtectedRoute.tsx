import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldX } from 'lucide-react';

interface ProtectedRouteProps {
  requiredRole?: 'ADMIN' | 'STAFF';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole }) => {
  const { user, accessToken, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-sage-600 animate-spin flex items-center justify-center text-white mb-4 shadow-lg shadow-sage-600/30">
          🌸
        </div>
        <p className="text-sm font-medium text-forest-700">Đang đồng bộ trạng thái phiên...</p>
      </div>
    );
  }

  if (!user || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.roleId !== requiredRole) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 bg-white rounded-3xl border border-rose-200 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
          <ShieldX className="w-8 h-8" />
        </div>
        <h3 className="font-serif text-xl font-bold text-forest-900">Truy cập bị giới hạn</h3>
        <p className="text-sm text-forest-600 leading-relaxed">
          Trang này chỉ dành cho tài khoản có quyền <strong>{requiredRole}</strong>. Tài khoản của bạn hiện là <strong>{user.roleName}</strong>.
        </p>
      </div>
    );
  }

  return <Outlet />;
};
