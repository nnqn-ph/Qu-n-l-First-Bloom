import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { formatDateTime } from '../../utils/format';
import { 
  Laptop, 
  Smartphone, 
  Globe, 
  ShieldAlert, 
  X, 
  LogOut, 
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

interface SessionItem {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface SessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SessionsModal: React.FC<SessionsModalProps> = ({ isOpen, onClose }) => {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/v1/auth/sessions');
      if (data?.success) {
        setSessions(data.data);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách phiên:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const handleRevoke = async (sessionId: string) => {
    if (!confirm('Bạn có chắc chắn muốn đăng xuất tài khoản khỏi thiết bị này?')) return;
    setRevokingId(sessionId);
    try {
      await api.delete(`/v1/auth/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi thu hồi phiên');
    } finally {
      setRevokingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full border border-sage-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-sage-100 flex items-center justify-between bg-cream-100/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sage-600 text-white flex items-center justify-center shadow-sm">
              <Globe className="w-5 h-5 text-cream-100" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-forest-900">Thiết bị & Phiên Đăng nhập</h3>
              <p className="text-xs text-forest-600">Quản lý các thiết bị đang cùng truy cập chung tài khoản</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-forest-600 hover:bg-sage-100 hover:text-forest-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between text-xs text-forest-600 px-1">
            <span>Danh sách phiên hoạt động ({sessions.length})</span>
            <button
              onClick={fetchSessions}
              disabled={loading}
              className="inline-flex items-center gap-1 hover:text-sage-700 font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>

          {sessions.length === 0 && !loading ? (
            <div className="text-center py-8 text-forest-600 text-sm">
              Không tìm thấy phiên đăng nhập nào.
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const isMobile = /mobile|iphone|android|ipad/i.test(session.deviceInfo);
                return (
                  <div
                    key={session.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      session.isCurrent
                        ? 'bg-sage-50/80 border-sage-300 ring-1 ring-sage-400/30'
                        : 'bg-white border-sage-200 hover:border-sage-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            session.isCurrent ? 'bg-sage-600 text-white' : 'bg-cream-200 text-forest-700'
                          }`}
                        >
                          {isMobile ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-forest-900">
                              {session.deviceInfo}
                            </span>
                            {session.isCurrent && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Thiết bị này
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-forest-600">
                            <span>IP: <code className="font-mono">{session.ipAddress}</code></span>
                            <span>•</span>
                            <span>Hoạt động cuối: {formatDateTime(session.lastActiveAt)}</span>
                          </div>
                        </div>
                      </div>

                      {!session.isCurrent && (
                        <button
                          onClick={() => handleRevoke(session.id)}
                          disabled={revokingId === session.id}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors inline-flex items-center gap-1.5 shrink-0"
                          title="Đăng xuất từ xa thiết bị này"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>{revokingId === session.id ? 'Đang hủy...' : 'Đăng xuất'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <p>
              Hệ thống hỗ trợ đăng nhập đồng thời trên nhiều thiết bị (máy bàn, laptop, smartphone). Khi bạn bấm "Đăng xuất" một thiết bị lạ, thiết bị đó sẽ lập tức bị hủy phiên và trở về màn hình đăng nhập theo thời gian thực.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-sage-100 bg-cream-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-sage-600 text-white hover:bg-sage-700 transition-colors shadow-sm"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
