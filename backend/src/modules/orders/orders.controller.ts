import { Request, Response } from 'express';
import { ordersService } from './orders.service';
import {
  createCustomerSchema,
  updateCustomerSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  addPaymentSchema,
  orderFilterSchema,
} from './orders.dto';
import { sendSuccess, sendError } from '../../common/response';

export class OrdersController {
  // ==========================================
  // 1. KHÁCH HÀNG (CUSTOMERS)
  // ==========================================

  async getCustomers(req: Request, res: Response) {
    try {
      const { search } = req.query;
      const customers = await ordersService.getCustomers(search ? String(search) : undefined);
      return sendSuccess(res, customers, 'Lấy danh sách khách hàng thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async getCustomerById(req: Request, res: Response) {
    try {
      const customer = await ordersService.getCustomerById(req.params.id);
      return sendSuccess(res, customer, 'Lấy chi tiết khách hàng thành công');
    } catch (error: any) {
      return sendError(res, error.message, 404);
    }
  }

  async createCustomer(req: Request, res: Response) {
    try {
      const parsed = createCustomerSchema.parse(req.body);
      const customer = await ordersService.createCustomer(parsed, req.user!.id);
      return sendSuccess(res, customer, 'Tạo khách hàng thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateCustomer(req: Request, res: Response) {
    try {
      const parsed = updateCustomerSchema.parse(req.body);
      const customer = await ordersService.updateCustomer(req.params.id, parsed, req.user!.id);
      return sendSuccess(res, customer, 'Cập nhật thông tin khách hàng thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  // ==========================================
  // 2. ĐƠN HÀNG (ORDERS)
  // ==========================================

  async getOrders(req: Request, res: Response) {
    try {
      const parsedFilters = orderFilterSchema.parse(req.query);
      const isStaff = req.user?.roleId === 'STAFF';
      const orders = await ordersService.getOrders(parsedFilters, isStaff);
      return sendSuccess(res, orders, 'Lấy danh sách đơn hàng thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async getOrderById(req: Request, res: Response) {
    try {
      const isStaff = req.user?.roleId === 'STAFF';
      const order = await ordersService.getOrderById(req.params.id, isStaff);
      return sendSuccess(res, order, 'Lấy chi tiết đơn hàng thành công');
    } catch (error: any) {
      return sendError(res, error.message, 404);
    }
  }

  async createOrder(req: Request, res: Response) {
    try {
      const parsed = createOrderSchema.parse(req.body);
      const order = await ordersService.createOrder(parsed, req.user!.id);
      return sendSuccess(res, order, 'Tạo đơn hàng thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateOrderStatus(req: Request, res: Response) {
    try {
      const parsed = updateOrderStatusSchema.parse(req.body);
      const order = await ordersService.updateOrderStatus(
        req.params.id,
        parsed,
        req.user!.id
      );
      return sendSuccess(res, order, 'Cập nhật trạng thái đơn hàng thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async addPayment(req: Request, res: Response) {
    try {
      const parsed = addPaymentSchema.parse(req.body);
      const order = await ordersService.addPayment(req.params.id, parsed, req.user!.id);
      return sendSuccess(res, order, 'Ghi nhận thanh toán / tiền cọc thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }
}

export const ordersController = new OrdersController();
