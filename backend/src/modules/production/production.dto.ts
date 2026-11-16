import { z } from 'zod';
import { ProductionType, ProductionStatus } from '@prisma/client';

// ==========================================
// 1. DTO CHO LỆNH SẢN XUẤT (PRODUCTION ORDER)
// ==========================================

export const createProductionOrderSchema = z.object({
  productId: z.string().uuid('ID sản phẩm không hợp lệ'),
  recipeId: z.string().uuid('ID công thức không hợp lệ').optional(),
  type: z.nativeEnum(ProductionType).default(ProductionType.MAKE_TO_STOCK),
  plannedQuantity: z.number().positive('Số lượng sản xuất kế hoạch phải lớn hơn 0'),
  linkedOrderId: z.string().uuid('ID đơn hàng không hợp lệ').optional(),
  notes: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
});

export const checkMaterialAvailabilitySchema = z.object({
  productId: z.string().uuid('ID sản phẩm không hợp lệ'),
  quantity: z.number().positive('Số lượng phải lớn hơn 0'),
  recipeId: z.string().uuid('ID công thức không hợp lệ').optional(),
});

export const startProductionSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const completeProductionSchema = z.object({
  completedQuantity: z.number().positive('Số lượng hoàn thành phải lớn hơn 0'),
  additionalCost: z.number().min(0, 'Chi phí phụ thêm không được âm').default(0),
  notes: z.string().max(500).optional(),
});

export const cancelProductionSchema = z.object({
  reason: z.string().min(2, 'Vui lòng cung cấp lý do hủy lệnh').max(300),
});

export const productionOrderFilterSchema = z.object({
  status: z.nativeEnum(ProductionStatus).optional(),
  type: z.nativeEnum(ProductionType).optional(),
  productId: z.string().uuid().optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

// ==========================================
// 2. DTO CHO TỒN KHO THÀNH PHẨM (PRODUCT INVENTORY)
// ==========================================

export const adjustProductStockSchema = z.object({
  productId: z.string().uuid('ID sản phẩm không hợp lệ'),
  actualQuantity: z.number().min(0, 'Số lượng tồn kho thực tế không được âm'),
  reason: z.string().min(2, 'Lý do kiểm kê điều chỉnh tối thiểu 2 ký tự').max(255),
});

export const productStockLedgerFilterSchema = z.object({
  productId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export type CreateProductionOrderDto = z.infer<typeof createProductionOrderSchema>;
export type CheckMaterialAvailabilityDto = z.infer<typeof checkMaterialAvailabilitySchema>;
export type StartProductionDto = z.infer<typeof startProductionSchema>;
export type CompleteProductionDto = z.infer<typeof completeProductionSchema>;
export type CancelProductionDto = z.infer<typeof cancelProductionSchema>;
export type ProductionOrderFilterDto = z.infer<typeof productionOrderFilterSchema>;
export type AdjustProductStockDto = z.infer<typeof adjustProductStockSchema>;
export type ProductStockLedgerFilterDto = z.infer<typeof productStockLedgerFilterSchema>;
