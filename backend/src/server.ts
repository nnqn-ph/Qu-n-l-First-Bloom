import http from 'http';
import net from 'net';
import path from 'path';
import { execSync } from 'child_process';
import { app } from './app';
import { env } from './config/env';
import { initSocketServer } from './websocket/socket.server';
import { prisma } from './config/prisma';
import { seedDatabase } from './config/seed';

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
      // @ts-ignore
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

async function ensureDatabaseSchema() {
  try {
    console.log('🔄 [Database] Đang kiểm tra và đồng bộ cấu trúc bảng PostgreSQL...');
    const backendDir = path.resolve(__dirname, '..');
    execSync('npx prisma db push --accept-data-loss', {
      cwd: backendDir,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
    });
    console.log('✅ [Database] Đã đồng bộ cấu trúc bảng thành công!');
  } catch (err: any) {
    console.warn('⚠️ [Database] prisma db push cảnh báo:', err?.message || err);
  }
}

async function startServer() {
  try {
    await ensureDatabaseRunning();
    await ensureDatabaseSchema();

    // Kết nối Prisma với Database
    await prisma.$connect();
    console.log('✅ [Database] Kết nối PostgreSQL thành công!');

    // Tự động kiểm tra và khởi tạo dữ liệu mẫu & Admin nếu database mới
    try {
      const adminCount = await prisma.user.count({ where: { roleId: 'ADMIN' } });
      if (adminCount === 0) {
        console.log('🌱 [Database] Cơ sở dữ liệu mới, đang tự động khởi tạo Roles, Tài khoản Admin và Dữ liệu mẫu...');
        await seedDatabase(prisma);
        console.log('✅ [Database] Đã tạo tài khoản Admin và dữ liệu mẫu thành công!');
      } else {
        console.log(`ℹ️ [Database] Đã có ${adminCount} tài khoản Admin trong hệ thống.`);
      }
    } catch (seedErr: any) {
      console.warn('⚠️ [Database] Lỗi khi auto-seed:', seedErr?.message || seedErr);
    }

    const port = parseInt(env.PORT, 10) || 5000;
    server.listen(port, '0.0.0.0', () => {
      console.log(`🌸 [First Bloom API] Server đang chạy tại: http://0.0.0.0:${port}`);
      console.log(`🔌 [Socket.IO] Realtime Gateway sẵn sàng tại ws://0.0.0.0:${port}`);
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
