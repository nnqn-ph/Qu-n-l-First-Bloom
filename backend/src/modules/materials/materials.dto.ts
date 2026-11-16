import { z } from 'zod';

// 1. Danh mục nguyên vật liệu
export const createCategorySchema = z.object({
  code: z.string().min(2, 'Mã danh mục phải có ít nhất 2 ký tự').toUpperCase(),
  name: z.string().min(2, 'Tên danh mục phải có ít nhất 2 ký tự'),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2, 'Tên danh mục phải có ít nhất 2 ký tự'),
});

// 2. Nguyên vật liệu
export const createMaterialSchema = z.object({
  sku: z.string().min(2, 'Mã nguyên vật liệu (SKU) phải có ít nhất 2 ký tự').toUpperCase(),
  name: z.string().min(2, 'Tên nguyên vật liệu phải có ít nhất 2 ký tự'),
  categoryId: z.string().uuid('Danh mục không hợp lệ'),
  unit: z.string().min(1, 'Đơn vị tính không được để trống'),
  defaultPrice: z.number().min(0, 'Giá mặc định không được âm').default(0),
  minStockAlert: z.number().min(0, 'Mức tồn kho tối thiểu không được âm').default(0),
  notes: z.string().optional(),
});

export const updateMaterialSchema = z.object({
  name: z.string().min(2, 'Tên nguyên vật liệu phải có ít nhất 2 ký tự').optional(),
  categoryId: z.string().uuid('Danh mục không hợp lệ').optional(),
  unit: z.string().min(1, 'Đơn vị tính không được để trống').optional(),
  defaultPrice: z.number().min(0, 'Giá mặc định không được âm').optional(),
  minStockAlert: z.number().min(0, 'Mức tồn kho tối thiểu không được âm').optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

// 3. Nhà cung cấp
export const createSupplierSchema = z.object({
  code: z.string().min(2, 'Mã nhà cung cấp phải có ít nhất 2 ký tự').toUpperCase(),
  name: z.string().min(2, 'Tên nhà cung cấp phải có ít nhất 2 ký tự'),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(2, 'Tên nhà cung cấp phải có ít nhất 2 ký tự').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

// 4. Phiếu nhập kho (Purchase Receipt)
export const purchaseReceiptItemSchema = z.object({
  materialId: z.string().uuid('Mã nguyên vật liệu không hợp lệ'),
  quantity: z.number().positive('Số lượng nhập phải lớn hơn 0'),
  unitPrice: z.number().min(0, 'Đơn giá mua thực tế không được âm'),
});

export const createPurchaseReceiptSchema = z.object({
  supplierId: z.string().uuid('Nhà cung cấp không hợp lệ'),
  receiptDate: z.string().optional(), // ISO date string
  notes: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER']).default('CASH'),
  items: z.array(purchaseReceiptItemSchema).min(1, 'Phiếu nhập phải có ít nhất 1 nguyên vật liệu'),
});

// 5. Điều chỉnh kiểm kê kho
export const adjustMaterialStockSchema = z.object({
  materialId: z.string().uuid('Mã nguyên vật liệu không hợp lệ'),
  actualQuantity: z.number().min(0, 'Số lượng tồn kiểm kê không được âm'),
  reason: z.string().min(2, 'Vui lòng nhập lý do kiểm kê/điều chỉnh kho'),
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
export type CreateMaterialDto = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialDto = z.infer<typeof updateMaterialSchema>;
export type CreateSupplierDto = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierDto = z.infer<typeof updateSupplierSchema>;
export type CreatePurchaseReceiptDto = z.infer<typeof createPurchaseReceiptSchema>;
export type AdjustMaterialStockDto = z.infer<typeof adjustMaterialStockSchema>;
