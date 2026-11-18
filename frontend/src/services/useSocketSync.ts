import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from './socket';

export type SocketSyncStatus = 'connected' | 'connecting' | 'disconnected';

export function useSocketSync() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SocketSyncStatus>(() => {
    const s = getSocket();
    return s.connected ? 'connected' : 'connecting';
  });

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      console.log('📡 [Realtime Sync] Socket connected! Invalidation cache triggered.');
      setStatus('connected');
      // Tự động làm mới toàn bộ cache khi vừa kết nối hoặc kết nối lại
      queryClient.invalidateQueries();
    };

    const handleDisconnect = (reason: string) => {
      console.warn('⚠️ [Realtime Sync] Socket disconnected:', reason);
      setStatus('disconnected');
    };

    const handleConnectError = (error: Error) => {
      console.warn('⚠️ [Realtime Sync] Connect error:', error.message);
      setStatus('connecting');
    };

    // Đăng ký lắng nghe sự kiện từ server
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    if (socket.connected) {
      setStatus('connected');
    } else {
      setStatus('connecting');
    }

    // 1. Đơn hàng
    const onOrderCreated = () => {
      console.log('🔔 [Sync] Nhận sự kiện ORDER_CREATED -> Làm mới danh sách đơn hàng & doanh thu');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-today-pnl'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory'] });
    };

    const onOrderStatusChanged = () => {
      console.log('🔔 [Sync] Nhận sự kiện ORDER_STATUS_CHANGED -> Cập nhật trạng thái đơn hàng & kho');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-today-pnl'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['product-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    };

    // 2. Sản phẩm & Tồn kho
    const onProductStockChanged = () => {
      console.log('🔔 [Sync] Nhận sự kiện PRODUCT_STOCK_CHANGED -> Cập nhật tồn kho sản phẩm');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['product-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-products'] });
    };

    const onProductUpdated = () => {
      console.log('🔔 [Sync] Nhận sự kiện PRODUCT_UPDATED -> Cập nhật danh mục sản phẩm');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-products'] });
    };

    // 3. Nguyên vật liệu
    const onMaterialUpdated = () => {
      console.log('🔔 [Sync] Nhận sự kiện MATERIAL_UPDATED -> Cập nhật nguyên vật liệu');
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['material-categories'] });
      queryClient.invalidateQueries({ queryKey: ['material-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-receipts'] });
    };

    // 4. Công thức BOM
    const onRecipeUpdated = () => {
      console.log('🔔 [Sync] Nhận sự kiện RECIPE_UPDATED -> Cập nhật công thức BOM');
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-detail'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    };

    // 5. Sản xuất
    const onProductionStatusChanged = () => {
      console.log('🔔 [Sync] Nhận sự kiện PRODUCTION_STATUS_CHANGED -> Cập nhật lệnh sản xuất & nguyên liệu');
      queryClient.invalidateQueries({ queryKey: ['production-orders'] });
      queryClient.invalidateQueries({ queryKey: ['production-order-detail'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    };

    // 6. Tài chính & Báo cáo
    const onFinanceUpdated = () => {
      console.log('🔔 [Sync] Nhận sự kiện FINANCE_UPDATED -> Cập nhật sổ quỹ & PnL');
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['reports-pnl'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-today-pnl'] });
    };

    // 7. Khách hàng
    const onCustomerUpdated = () => {
      console.log('🔔 [Sync] Nhận sự kiện CUSTOMER_UPDATED -> Cập nhật khách hàng');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-detail'] });
    };

    socket.on('ORDER_CREATED', onOrderCreated);
    socket.on('ORDER_STATUS_CHANGED', onOrderStatusChanged);
    socket.on('PRODUCT_STOCK_CHANGED', onProductStockChanged);
    socket.on('PRODUCT_UPDATED', onProductUpdated);
    socket.on('MATERIAL_UPDATED', onMaterialUpdated);
    socket.on('RECIPE_UPDATED', onRecipeUpdated);
    socket.on('PRODUCTION_STATUS_CHANGED', onProductionStatusChanged);
    socket.on('FINANCE_UPDATED', onFinanceUpdated);
    socket.on('CUSTOMER_UPDATED', onCustomerUpdated);

    // Xử lý khi người dùng có mạng trở lại hoặc chuyển lại tab (Visibility Change)
    const handleOnline = () => {
      console.log('🌐 [Network] Trình duyệt đã online trở lại, đang kết nối lại Socket...');
      if (!socket.connected) {
        socket.connect();
      }
      queryClient.invalidateQueries();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!socket.connected) {
          socket.connect();
        }
        queryClient.invalidateQueries();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('ORDER_CREATED', onOrderCreated);
      socket.off('ORDER_STATUS_CHANGED', onOrderStatusChanged);
      socket.off('PRODUCT_STOCK_CHANGED', onProductStockChanged);
      socket.off('PRODUCT_UPDATED', onProductUpdated);
      socket.off('MATERIAL_UPDATED', onMaterialUpdated);
      socket.off('RECIPE_UPDATED', onRecipeUpdated);
      socket.off('PRODUCTION_STATUS_CHANGED', onProductionStatusChanged);
      socket.off('FINANCE_UPDATED', onFinanceUpdated);
      socket.off('CUSTOMER_UPDATED', onCustomerUpdated);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient]);

  return { status, isConnected: status === 'connected' };
}
