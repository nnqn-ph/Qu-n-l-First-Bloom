import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('🌸 [Socket.IO] Đã kết nối Realtime tới Server First Bloom:', socket?.id);
    });

    socket.on('connect_error', (error) => {
      console.warn('⚠️ [Socket.IO] Lỗi kết nối Realtime:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 [Socket.IO] Ngắt kết nối Realtime:', reason);
    });
  }

  return socket;
}
