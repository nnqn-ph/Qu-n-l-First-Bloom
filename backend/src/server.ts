import http from 'http';
import net from 'net';
import path from 'path';
import { app } from './app';
import { env } from './config/env';
import { initSocketServer } from './websocket/socket.server';
import { prisma } from './config/prisma';

const server = http.createServer(app);

// Khởi tạo Socket.IO Server gắn với HTTP Server
initSocketServer(server);

function checkPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function ensureDatabaseRunning() {
  const is5432Open = await checkPortOpen(5432);
  if (!is5432Open && env.NODE_ENV !== 'production') {
    console.log('🐘 [Auto-Database] Không tìm thấy PostgreSQL ngoài cổng 5432, đang tự động khởi chạy PGlite Server...');
    try {
      const { PGlite } = await import('@electric-sql/pglite');
      // @ts-ignore
      const { createServer: createPgServer } = await import('pglite-server');
      const dataDir = path.resolve(__dirname, '../dev-postgres-data');
      const db = new PGlite(dataDir);
      await db.waitReady;
      const pgServer = createPgServer(db);
      await new Promise<void>((resolve) => {
        pgServer.listen(5432, () => {
          console.log('🐘 [Auto-Database] PostgreSQL engine (PGlite) đã sẵn sàng tại port 5432!');
          resolve();
        });
      });
    } catch (e) {
      console.warn('⚠️ [Auto-Database] Không thể tự khởi chạy PGlite:', e);
    }
  }
}

async function startServer() {
  try {
    await ensureDatabaseRunning();

    // Kết nối Prisma với Database
    await prisma.$connect();
    console.log('✅ [Database] Kết nối PostgreSQL thành công!');

    const port = parseInt(env.PORT, 10) || 5000;
    server.listen(port, () => {
      console.log(`🌸 [First Bloom API] Server đang chạy tại: http://localhost:${port}`);
      console.log(`🔌 [Socket.IO] Realtime Gateway sẵn sàng tại ws://localhost:${port}`);
    });
  } catch (error) {
    console.error('❌ [Server Error]:', error);
  }
}

// Bắt tín hiệu dừng ứng dụng an toàn (Graceful Shutdown)
process.on('SIGTERM', async () => {
  console.log('🛑 Nhận tín hiệu SIGTERM, đang đóng kết nối...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Server đã dừng an toàn.');
    process.exit(0);
  });
});

startServer();
