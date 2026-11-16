import { Request, Response } from 'express';
import { materialsService } from './materials.service';
import { 
  createCategorySchema, 
  updateCategorySchema, 
  createMaterialSchema, 
  updateMaterialSchema, 
  createSupplierSchema, 
  updateSupplierSchema, 
  createPurchaseReceiptSchema,
  adjustMaterialStockSchema
} from './materials.dto';
import { sendSuccess, sendError } from '../../common/response';

export class MaterialsController {
  // 1. DANH MỤC
  async getCategories(req: Request, res: Response) {
    try {
      const categories = await materialsService.getCategories();
      return sendSuccess(res, categories, 'Lấy danh mục thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async createCategory(req: Request, res: Response) {
    try {
      const validated = createCategorySchema.parse(req.body);
      const category = await materialsService.createCategory(validated);
      return sendSuccess(res, category, 'Tạo danh mục thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validated = updateCategorySchema.parse(req.body);
      const updated = await materialsService.updateCategory(id, validated);
      return sendSuccess(res, updated, 'Cập nhật danh mục thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await materialsService.deleteCategory(id);
      return sendSuccess(res, deleted, 'Xóa danh mục thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  // 2. NGUYÊN VẬT LIỆU
  async getMaterials(req: Request, res: Response) {
    try {
      const { categoryId, search, lowStockOnly } = req.query;
      const materials = await materialsService.getMaterials({
        categoryId: categoryId as string,
        search: search as string,
        lowStockOnly: lowStockOnly === 'true',
      });
      return sendSuccess(res, materials, 'Lấy danh sách nguyên vật liệu thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async getMaterialById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const material = await materialsService.getMaterialById(id);
      return sendSuccess(res, material, 'Lấy chi tiết nguyên vật liệu thành công');
    } catch (error: any) {
      return sendError(res, error.message, 404);
    }
  }

  async createMaterial(req: Request, res: Response) {
    try {
      const validated = createMaterialSchema.parse(req.body);
      const userId = req.user!.id;
      const material = await materialsService.createMaterial(validated, userId);
      return sendSuccess(res, material, 'Tạo nguyên vật liệu thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateMaterial(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validated = updateMaterialSchema.parse(req.body);
      const userId = req.user!.id;
      const updated = await materialsService.updateMaterial(id, validated, userId);
      return sendSuccess(res, updated, 'Cập nhật nguyên vật liệu thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async deleteMaterial(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const deleted = await materialsService.deleteMaterial(id, userId);
      return sendSuccess(res, deleted, 'Xóa nguyên vật liệu thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  // 3. NHÀ CUNG CẤP
  async getSuppliers(req: Request, res: Response) {
    try {
      const suppliers = await materialsService.getSuppliers();
      return sendSuccess(res, suppliers, 'Lấy danh sách nhà cung cấp thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async createSupplier(req: Request, res: Response) {
    try {
      const validated = createSupplierSchema.parse(req.body);
      const supplier = await materialsService.createSupplier(validated);
      return sendSuccess(res, supplier, 'Tạo nhà cung cấp thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async updateSupplier(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validated = updateSupplierSchema.parse(req.body);
      const updated = await materialsService.updateSupplier(id, validated);
      return sendSuccess(res, updated, 'Cập nhật nhà cung cấp thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async deleteSupplier(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await materialsService.deleteSupplier(id);
      return sendSuccess(res, deleted, 'Xóa nhà cung cấp thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  // 4. PHIẾU NHẬP KHO & MWAC
  async getPurchaseReceipts(req: Request, res: Response) {
    try {
      const { supplierId, fromDate, toDate } = req.query;
      const receipts = await materialsService.getPurchaseReceipts({
        supplierId: supplierId as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
      });
      return sendSuccess(res, receipts, 'Lấy danh sách phiếu nhập kho thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }

  async getPurchaseReceiptById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const receipt = await materialsService.getPurchaseReceiptById(id);
      return sendSuccess(res, receipt, 'Lấy chi tiết phiếu nhập kho thành công');
    } catch (error: any) {
      return sendError(res, error.message, 404);
    }
  }

  async createPurchaseReceipt(req: Request, res: Response) {
    try {
      const validated = createPurchaseReceiptSchema.parse(req.body);
      const userId = req.user!.id;
      const receipt = await materialsService.createPurchaseReceipt(validated, userId);
      return sendSuccess(res, receipt, 'Tạo phiếu nhập kho và tính giá vốn MWAC thành công', 201);
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  // 5. KIỂM KÊ KHO & SỔ CÁI
  async adjustMaterialStock(req: Request, res: Response) {
    try {
      const validated = adjustMaterialStockSchema.parse(req.body);
      const userId = req.user!.id;
      const result = await materialsService.adjustMaterialStock(validated, userId);
      return sendSuccess(res, result, 'Điều chỉnh kiểm kê kho thành công');
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }

  async getMaterialStockLedger(req: Request, res: Response) {
    try {
      const { materialId, fromDate, toDate } = req.query;
      const ledger = await materialsService.getMaterialStockLedger({
        materialId: materialId as string,
        fromDate: fromDate as string,
        toDate: toDate as string,
      });
      return sendSuccess(res, ledger, 'Lấy sổ cái biến động kho NVL thành công');
    } catch (error: any) {
      return sendError(res, error.message, 500);
    }
  }
}

export const materialsController = new MaterialsController();
