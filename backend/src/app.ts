import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { env } from './config/env';
import { sendError, sendSuccess } from './common/response';

export const app = express();

// 1. Bảo mật & Middleware cơ bản
app.use(helmet({ crossOriginResourcePolicy: false }));

// Cấu hình CORS linh hoạt cho cả localhost, 127.0.0.1 và mạng LAN di động
app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép tất cả request từ localhost, 127.0.0.1, mạng LAN hoặc không có origin (server-to-server)
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 2. Request Logging Middleware (Development)
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// 3. Healthcheck Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'ONLINE',
    system: 'First Bloom Flower Shop Management API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 4. Định tuyến API Router (Các module)
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { 
  materialCategoriesRouter, 
  materialsRouter, 
  suppliersRouter, 
  purchaseReceiptsRouter, 
  materialInventoryRouter 
} from './modules/materials/materials.routes';
import productsRoutes from './modules/products/products.routes';
import productionRoutes from './modules/production/production.routes';
import ordersRoutes from './modules/orders/orders.routes';
import financeRoutes from './modules/finance/finance.routes';

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/material-categories', materialCategoriesRouter);
app.use('/api/v1/materials', materialsRouter);
app.use('/api/v1/suppliers', suppliersRouter);
app.use('/api/v1/purchase-receipts', purchaseReceiptsRouter);
app.use('/api/v1/inventory/materials', materialInventoryRouter);
app.use('/api/v1', productsRoutes);
app.use('/api/v1', productionRoutes);
app.use('/api/v1', ordersRoutes);
app.use('/api/v1', financeRoutes);

// 5. 404 Handler cho endpoint không tồn tại
app.use((req: Request, res: Response) => {
  sendError(res, `Endpoint '${req.method} ${req.originalUrl}' không tồn tại trên hệ thống`, 404);
});

// 6. Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('🔥 [Unhandled Error]:', err);

  if (err instanceof ZodError) {
    return sendError(res, 'Dữ liệu yêu cầu không hợp lệ', 422, err.flatten().fieldErrors);
  }

  return sendError(
    res,
    env.NODE_ENV === 'production' ? 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau.' : err.message,
    500
  );
});
