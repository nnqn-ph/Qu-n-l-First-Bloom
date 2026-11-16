import { Router } from 'express';
import { productionController } from './production.controller';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';

const router = Router();

// ==========================================
// 1. LỆNH SẢN XUẤT (ADMIN ONLY)
// ==========================================

router.post(
  '/production/check-availability',
  authenticate,
  requireRole('ADMIN'),
  productionController.checkAvailability.bind(productionController)
);

router.get(
  '/production',
  authenticate,
  requireRole('ADMIN'),
  productionController.getOrders.bind(productionController)
);

router.get(
  '/production/:id',
  authenticate,
  requireRole('ADMIN'),
  productionController.getOrderById.bind(productionController)
);

router.post(
  '/production',
  authenticate,
  requireRole('ADMIN'),
  productionController.createOrder.bind(productionController)
);

router.post(
  '/production/:id/start',
  authenticate,
  requireRole('ADMIN'),
  productionController.startProduction.bind(productionController)
);

router.post(
  '/production/:id/complete',
  authenticate,
  requireRole('ADMIN'),
  productionController.completeProduction.bind(productionController)
);

router.post(
  '/production/:id/cancel',
  authenticate,
  requireRole('ADMIN'),
  productionController.cancelOrder.bind(productionController)
);

// ==========================================
// 2. KHO THÀNH PHẨM (PRODUCT INVENTORY)
// ==========================================

// Staff được phép xem danh sách tồn kho thành phẩm (chế độ chỉ đọc)
router.get(
  '/inventory/products',
  authenticate,
  productionController.getProductInventory.bind(productionController)
);

// Admin điều chỉnh kiểm kê kho
router.post(
  '/inventory/products/adjust',
  authenticate,
  requireRole('ADMIN'),
  productionController.adjustProductStock.bind(productionController)
);

// Admin xem sổ thẻ kho thành phẩm
router.get(
  '/inventory/products/ledger',
  authenticate,
  requireRole('ADMIN'),
  productionController.getProductStockLedger.bind(productionController)
);

export default router;
