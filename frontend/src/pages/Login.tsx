import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Flower2, 
  Lock, 
  User as UserIcon, 
  Smartphone, 
  ArrowRight, 
  AlertCircle,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nếu người dùng đã có phiên hợp lệ, tự động chuyển về trang chủ
  React.useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password, deviceInfo);
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Lỗi đăng nhập:', err);
      const msg =
        err.response?.data?.message ||
        (err.message === 'Network Error' ? 'Không thể kết nối tới máy chủ Backend (Port 5000)' : err.message) ||
        'Đăng nhập không thành công, vui lòng thử lại';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = (user: string, pass: string, device: string) => {
    setUsername(user);
    setPassword(pass);
    setDeviceInfo(device);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative selection:bg-rose-200">
      {/* Decorative Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-sage-200/40 via-cream-200/50 to-rose-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-sage-600 text-white items-center justify-center shadow-lg shadow-sage-600/30 mb-4 ring-4 ring-sage-100">
          <Flower2 className="w-9 h-9 text-cream-100" />
        </div>
        <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-forest-900">
          First Bloom
        </h2>
        <p className="mt-2 text-sm text-forest-600 font-medium">
          Hệ thống Quản lý Tiệm hoa Kẽm nhung & Đồng bộ Tập trung
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-3xl border border-sage-200/80 shadow-xl shadow-sage-900/5 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-forest-800 uppercase tracking-wider mb-1.5">
                Tên đăng nhập
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-forest-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin hoặc staff01"
                  required
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 placeholder-forest-500/60 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-forest-800 uppercase tracking-wider mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-forest-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 placeholder-forest-500/60 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-forest-800 uppercase tracking-wider mb-1.5">
                Tên thiết bị (Tùy chọn)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-forest-500">
                  <Smartphone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={deviceInfo}
                  onChange={(e) => setDeviceInfo(e.target.value)}
                  placeholder="VD: Laptop Quản lý, Mobile Thợ cắm..."
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-cream-50/50 border border-sage-200 rounded-xl text-forest-900 placeholder-forest-500/60 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-sage-600 hover:bg-sage-700 active:bg-sage-800 transition-all shadow-md shadow-sage-600/20 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Login helper */}
          <div className="pt-4 border-t border-sage-100">
            <p className="text-xs font-medium text-forest-600 text-center mb-3 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              <span>Đăng nhập thử nghiệm nhanh theo vai trò:</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin', 'Admin@FirstBloom2026!', 'Máy tính Bàn (Chủ Tiệm)')}
                className="p-2.5 text-xs text-left rounded-xl bg-sage-50 hover:bg-sage-100 border border-sage-200/80 transition-colors"
              >
                <div className="font-semibold text-sage-900">1. Quyền ADMIN</div>
                <div className="text-[11px] text-sage-600">Toàn quyền hệ thống</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('staff01', 'Staff@FirstBloom2026!', 'Điện thoại (Thu Ngân)')}
                className="p-2.5 text-xs text-left rounded-xl bg-cream-100 hover:bg-cream-200/80 border border-cream-300 transition-colors"
              >
                <div className="font-semibold text-forest-900">2. Quyền STAFF</div>
                <div className="text-[11px] text-forest-600">Chỉ bán & đơn hàng</div>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-forest-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Phiên làm việc bảo mật với HttpOnly Refresh Token & Socket Sync</span>
        </div>
      </div>
    </div>
  );
};
