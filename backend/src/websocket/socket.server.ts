import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from '../config/env';

export enum WsEvent {
  MATERIAL_UPDATED = 'MATERIAL_UPDATED',
  PRODUCT_UPDATED = 'PRODUCT_UPDATED',
  RECIPE_UPDATED = 'RECIPE_UPDATED',
  PRODUCT_STOCK_CHANGED = 'PRODUCT_STOCK_CHANGED',
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_STATUS_CHANGED = 'ORDER_STATUS_CHANGED',
  PRODUCTION_STATUS_CHANGED = 'PRODUCTION_STATUS_CHANGED',
  FINANCE_UPDATED = 'FINANCE_UPDATED',
  SESSION_REVOKED = 'SESSION_REVOKED',
}

export interface WsPayload<T = unknown> {
  entity: string;
  action: string;
  timestamp: string;
  data?: T;
}

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 [Socket.IO] Thiết bị kết nối thành công: ${socket.id}`);

    // Cho phép client join room chung của cửa hàng
    socket.join('shop_main');

    socket.on('disconnect', (reason) => {
      console.log(`🔌 [Socket.IO] Thiết bị ngắt kết nối: ${socket.id} (${reason})`);
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO Server chưa được khởi tạo!');
  }
  return io;
}

/**
 * Phát sự kiện realtime tới tất cả thiết bị đang mở của tiệm
 */
export function broadcastSyncEvent<T = unknown>(event: WsEvent, payload: WsPayload<T>) {
  if (io) {
    io.to('shop_main').emit(event, payload);
    console.log(`📡 [Socket.IO] Đã phát sự kiện realtime '${event}' tới các thiết bị:`, payload.entity, payload.action);
  }
}

/**
 * Thông báo thu hồi phiên để thiết bị đích tự động logout
 */
export function emitSessionRevoked(sessionId: string) {
  if (io) {
    io.emit(WsEvent.SESSION_REVOKED, { sessionId });
    console.log(`🔒 [Socket.IO] Đã phát lệnh thu hồi phiên: ${sessionId}`);
  }
}
