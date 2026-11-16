import { Router } from 'express';
import { financeController } from './finance.controller';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';

const router = Router();

// Toàn bộ module Tài chính và Báo cáo P&L chỉ dành riêng cho ADMIN
router.use(authenticate, requireRole('ADMIN'));

// ==========================================
// 1. DANH MỤC CHI PHÍ
// ==========================================

router.get(
  '/expense-categories',
  financeController.getCategories.bind(financeController)
);

router.post(
  '/expense-categories',
  financeController.createCategory.bind(financeController)
);

router.patch(
  '/expense-categories/:id',
  financeController.updateCategory.bind(financeController)
);

router.delete(
  '/expense-categories/:id',
  financeController.deleteCategory.bind(financeController)
);

// ==========================================
// 2. SỔ QUỸ THU CHI (FINANCIAL TRANSACTIONS)
// ==========================================

router.get(
  '/finance/transactions',
  financeController.getTransactions.bind(financeController)
);

router.get(
  '/finance/transactions/export',
  financeController.exportTransactions.bind(financeController)
);

router.get(
  '/finance/transactions/:id',
  financeController.getTransactionById.bind(financeController)
);

router.post(
  '/finance/transactions',
  financeController.createTransaction.bind(financeController)
);

// ==========================================
// 3. BÁO CÁO DOANH THU & LỢI NHUẬN (P&L)
// ==========================================

router.get(
  '/reports/profit-and-loss',
  financeController.getProfitAndLoss.bind(financeController)
);

router.get(
  '/reports/profit-and-loss/export',
  financeController.exportProfitAndLoss.bind(financeController)
);

export default router;
