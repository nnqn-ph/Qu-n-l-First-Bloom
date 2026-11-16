import { Request, Response } from 'express';
import { financeService } from './finance.service';
import {
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  createFinancialTransactionSchema,
  transactionFilterSchema,
  reportFilterSchema,
} from './finance.dto';
import { sendSuccess, sendError } from '../../common/response';

export class FinanceController {
  // ==========================================
  // 1. DANH MỤC THU / CHI
  // ==========================================

  async getCategories(req: Request, res: Response) {
    try {
      const categories = await financeService.getCategories();
      return sendSuccess(res, categories, 'Lấy danh mục chi phí thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async createCategory(req: Request, res: Response) {
    try {
      const parsed = createExpenseCategorySchema.parse(req.body);
      const category = await financeService.createCategory(parsed, req.user!.id);
      return sendSuccess(res, category, 'Tạo danh mục chi phí thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateCategory(req: Request, res: Response) {
    try {
      const parsed = updateExpenseCategorySchema.parse(req.body);
      const category = await financeService.updateCategory(req.params.id, parsed, req.user!.id);
      return sendSuccess(res, category, 'Cập nhật danh mục chi phí thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async deleteCategory(req: Request, res: Response) {
    try {
      await financeService.deleteCategory(req.params.id, req.user!.id);
      return sendSuccess(res, null, 'Đã xóa danh mục chi phí');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  // ==========================================
  // 2. SỔ QUỸ THU CHI (FINANCIAL TRANSACTIONS)
  // ==========================================

  async getTransactions(req: Request, res: Response) {
    try {
      const parsedFilters = transactionFilterSchema.parse(req.query);
      const result = await financeService.getTransactions(parsedFilters);
      return sendSuccess(res, result, 'Lấy danh sách sổ quỹ thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async getTransactionById(req: Request, res: Response) {
    try {
      const item = await financeService.getTransactionById(req.params.id);
      return sendSuccess(res, item, 'Lấy chi tiết phiếu thu chi thành công');
    } catch (error: any) {
      return sendError(res, error.message, 404);
    }
  }

  async createTransaction(req: Request, res: Response) {
    try {
      const parsed = createFinancialTransactionSchema.parse(req.body);
      const transaction = await financeService.createManualTransaction(parsed, req.user!.id);
      return sendSuccess(res, transaction, 'Lập phiếu thu/chi thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async exportTransactions(req: Request, res: Response) {
    try {
      const parsedFilters = transactionFilterSchema.parse(req.query);
      const buffer = await financeService.exportTransactionsExcel(parsedFilters);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="so_quy_thu_chi_${Date.now()}.xlsx"`
      );
      return res.send(buffer);
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  // ==========================================
  // 3. BÁO CÁO DOANH THU & LỢI NHUẬN (P&L)
  // ==========================================

  async getProfitAndLoss(req: Request, res: Response) {
    try {
      const parsedFilters = reportFilterSchema.parse(req.query);
      const report = await financeService.getProfitAndLoss(parsedFilters);
      return sendSuccess(res, report, 'Lấy báo cáo kết quả kinh doanh thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async exportProfitAndLoss(req: Request, res: Response) {
    try {
      const parsedFilters = reportFilterSchema.parse(req.query);
      const buffer = await financeService.exportProfitAndLossExcel(parsedFilters);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="bao_cao_ket_qua_kinh_doanh_${Date.now()}.xlsx"`
      );
      return res.send(buffer);
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }
}

export const financeController = new FinanceController();
