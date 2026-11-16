import { Router } from 'express';
import { ordersController } from './orders.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// ==========================================
// 1. KHÁCH HÀNG (CUSTOMERS)
// Cả Admin và Staff đều có quyền quản lý khách hàng
// ==========================================

router.get(
  '/customers',
  authenticate,
  ordersController.getCustomers.bind(ordersController)
);

router.get(
  '/customers/:id',
  authenticate,
  ordersController.getCustomerById.bind(ordersController)
);

router.post(
  '/customers',
  authenticate,
  ordersController.createCustomer.bind(ordersController)
);

router.patch(
  '/customers/:id',
  authenticate,
  ordersController.updateCustomer.bind(ordersController)
);

// ==========================================
// 2. ĐƠN HÀNG & THANH TOÁN (ORDERS & PAYMENTS)
// Cả Admin và Staff đều có quyền quản lý đơn hàng
// ==========================================

router.get(
  '/orders',
  authenticate,
  ordersController.getOrders.bind(ordersController)
);

router.get(
  '/orders/:id',
  authenticate,
  ordersController.getOrderById.bind(ordersController)
);

router.post(
  '/orders',
  authenticate,
  ordersController.createOrder.bind(ordersController)
);

router.patch(
  '/orders/:id/status',
  authenticate,
  ordersController.updateOrderStatus.bind(ordersController)
);

router.post(
  '/orders/:id/payments',
  authenticate,
  ordersController.addPayment.bind(ordersController)
);

export default router;
