import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

export interface User {
  id: string;
  username: string;
  fullName: string;
  roleId: 'ADMIN' | 'STAFF';
  roleName: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  sessionId: string | null;
  isLoading: boolean;
  login: (username: string, password: string, deviceInfo?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('fb_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return sessionStorage.getItem('fb_access_token');
  });
  const [sessionId, setSessionId] = useState<string | null>(() => {
    return sessionStorage.getItem('fb_session_id');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Khôi phục phiên khi tải lại trang (F5)
  useEffect(() => {
    let isCancelled = false;

    const restoreSession = async () => {
      // Nếu đã có token còn hiệu lực trong session, kết thúc trạng thái loading ngay
      const existingToken = sessionStorage.getItem('fb_access_token');
      if (existingToken) {
        setIsLoading(false);
        return;
      }

      // Chỉ thử refresh nếu có thông tin user lưu trước đó
      const hasPreviousLogin = localStorage.getItem('fb_user');
      if (!hasPreviousLogin) {
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await api.post('/v1/auth/refresh');
        if (!isCancelled && data?.success && data?.data) {
          setAccessToken(data.data.accessToken);
          setUser(data.data.user);
          setSessionId(data.data.sessionId || null);
          sessionStorage.setItem('fb_access_token', data.data.accessToken);
          localStorage.setItem('fb_user', JSON.stringify(data.data.user));
        }
      } catch {
        // Chỉ dọn dẹp nếu người dùng chưa kịp đăng nhập bằng một luồng khác
        if (!isCancelled && !sessionStorage.getItem('fb_access_token')) {
          setAccessToken(null);
          setUser(null);
          localStorage.removeItem('fb_user');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Lắng nghe sự kiện Realtime Thu hồi phiên từ xa qua Socket.IO
  useEffect(() => {
    const socket = getSocket();

    const handleSessionRevoked = (data: { sessionId: string }) => {
      const currentSid = sessionStorage.getItem('fb_session_id') || sessionId;
      if (data?.sessionId && data.sessionId === currentSid) {
        alert('⚠️ Phiên đăng nhập trên thiết bị này đã bị thu hồi từ xa. Vui lòng đăng nhập lại.');
        setAccessToken(null);
        setUser(null);
        sessionStorage.removeItem('fb_access_token');
        sessionStorage.removeItem('fb_session_id');
        localStorage.removeItem('fb_user');
        window.location.href = '/login';
      }
    };

    socket.on('SESSION_REVOKED', handleSessionRevoked);

    return () => {
      socket.off('SESSION_REVOKED', handleSessionRevoked);
    };
  }, [sessionId]);

  const login = async (username: string, password: string, deviceInfo?: string) => {
    setIsLoading(true);
    try {
      const { data } = await api.post('/v1/auth/login', { username, password, deviceInfo });
      if (data.success) {
        const { user: loggedUser, accessToken: token, sessionId: sid } = data.data;
        setUser(loggedUser);
        setAccessToken(token);
        setSessionId(sid);
        sessionStorage.setItem('fb_access_token', token);
        sessionStorage.setItem('fb_session_id', sid);
        localStorage.setItem('fb_user', JSON.stringify(loggedUser));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/v1/auth/logout');
    } catch (err) {
      console.warn('Lỗi đăng xuất API:', err);
    } finally {
      setUser(null);
      setAccessToken(null);
      setSessionId(null);
      sessionStorage.removeItem('fb_access_token');
      sessionStorage.removeItem('fb_session_id');
      localStorage.removeItem('fb_user');
      window.location.href = '/login';
    }
  };

  const refreshAuth = async () => {
    try {
      const { data } = await api.post('/v1/auth/refresh');
      if (data?.data) {
        setAccessToken(data.data.accessToken);
        setUser(data.data.user);
        sessionStorage.setItem('fb_access_token', data.data.accessToken);
      }
    } catch (err) {
      await logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, sessionId, isLoading, login, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return context;
};
