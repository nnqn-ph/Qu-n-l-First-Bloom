import { Request, Response } from 'express';
import { productionService } from './production.service';
import {
  createProductionOrderSchema,
  checkMaterialAvailabilitySchema,
  startProductionSchema,
  completeProductionSchema,
  cancelProductionSchema,
  productionOrderFilterSchema,
  adjustProductStockSchema,
  productStockLedgerFilterSchema,
} from './production.dto';
import { sendSuccess, sendError } from '../../common/response';

export class ProductionController {
  // ==========================================
  // 1. LỆNH SẢN XUẤT (PRODUCTION ORDERS)
  // ==========================================

  async checkAvailability(req: Request, res: Response) {
    try {
      const parsed = checkMaterialAvailabilitySchema.parse(req.body);
      const result = await productionService.checkMaterialAvailability(parsed);
      return sendSuccess(res, result, 'Kiểm tra khả dụng nguyên vật liệu thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async getOrders(req: Request, res: Response) {
    try {
      const parsedFilters = productionOrderFilterSchema.parse(req.query);
      const orders = await productionService.getProductionOrders(parsedFilters);
      return sendSuccess(res, orders, 'Lấy danh sách lệnh sản xuất thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async getOrderById(req: Request, res: Response) {
    try {
      const order = await productionService.getProductionOrderById(req.params.id);
      return sendSuccess(res, order, 'Lấy chi tiết lệnh sản xuất thành công');
    } catch (error: any) {
      return sendError(res, error.message, 404);
    }
  }

  async createOrder(req: Request, res: Response) {
    try {
      const parsed = createProductionOrderSchema.parse(req.body);
      const order = await productionService.createProductionOrder(parsed, req.user!.id);
      return sendSuccess(res, order, 'Tạo lệnh sản xuất thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async startProduction(req: Request, res: Response) {
    try {
      const parsed = startProductionSchema.parse(req.body);
      const order = await productionService.startProduction(req.params.id, req.user!.id, parsed.notes);
      return sendSuccess(res, order, 'Bắt đầu xuất kho sản xuất thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async completeProduction(req: Request, res: Response) {
    try {
      const parsed = completeProductionSchema.parse(req.body);
      const order = await productionService.completeProduction(req.params.id, req.user!.id, parsed);
      return sendSuccess(res, order, 'Hoàn thành sản xuất và nhập kho thành phẩm thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async cancelOrder(req: Request, res: Response) {
    try {
      const parsed = cancelProductionSchema.parse(req.body);
      const order = await productionService.cancelProduction(req.params.id, req.user!.id, parsed.reason);
      return sendSuccess(res, order, 'Hủy lệnh sản xuất thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  // ==========================================
  // 2. KHO THÀNH PHẨM (PRODUCT INVENTORY)
  // ==========================================

  async getProductInventory(req: Request, res: Response) {
    try {
      const { search, categoryId } = req.query;
      const isStaff = req.user?.roleId === 'STAFF';
      const inventory = await productionService.getProductInventoryList(
        search ? String(search) : undefined,
        categoryId ? String(categoryId) : undefined,
        isStaff
      );
      return sendSuccess(res, inventory, 'Lấy danh sách tồn kho thành phẩm thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async adjustProductStock(req: Request, res: Response) {
    try {
      const parsed = adjustProductStockSchema.parse(req.body);
      const result = await productionService.adjustProductStock(parsed, req.user!.id);
      return sendSuccess(res, result, 'Kiểm kê điều chỉnh kho thành phẩm thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async getProductStockLedger(req: Request, res: Response) {
    try {
      const parsedFilters = productStockLedgerFilterSchema.parse(req.query);
      const ledger = await productionService.getProductStockLedger(parsedFilters);
      return sendSuccess(res, ledger, 'Lấy sổ thẻ kho thành phẩm thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }
}

export const productionController = new ProductionController();
