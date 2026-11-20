import { z } from 'zod';

// 1. Danh mục nguyên vật liệu
export const createCategorySchema = z.object({
  code: z
    .string()
    .max(50, 'Mã danh mục tối đa 50 ký tự')
    .optional()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim().toUpperCase())),
  name: z.string().min(1, 'Tên danh mục không được để trống'),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1, 'Tên danh mục không được để trống'),
});

// 2. Nguyên vật liệu
export const createMaterialSchema = z.object({
  sku: z
    .string()
    .max(50, 'Mã SKU tối đa 50 ký tự')
    .optional()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim().toUpperCase())),
  name: z.string().min(1, 'Tên nguyên vật liệu không được để trống'),
  categoryId: z
    .string()
    .uuid('Danh mục không hợp lệ')
    .optional()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
  unit: z.string().min(1, 'Đơn vị tính không được để trống'),
  defaultPrice: z.coerce.number().min(0, 'Giá mặc định không được âm').default(0),
  minStockAlert: z.coerce.number().min(0, 'Mức tồn kho tối thiểu không được âm').default(0),
  notes: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
});

export const updateMaterialSchema = z.object({
  name: z.string().min(1, 'Tên nguyên vật liệu không được để trống').optional(),
  categoryId: z.string().uuid('Danh mục không hợp lệ').optional(),
  unit: z.string().min(1, 'Đơn vị tính không được để trống').optional(),
  defaultPrice: z.coerce.number().min(0, 'Giá mặc định không được âm').optional(),
  minStockAlert: z.coerce.number().min(0, 'Mức tồn kho tối thiểu không được âm').optional(),
  isActive: z.boolean().optional(),
  notes: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
});

// 3. Nhà cung cấp
export const createSupplierSchema = z.object({
  code: z
    .string()
    .max(50, 'Mã nhà cung cấp tối đa 50 ký tự')
    .optional()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim().toUpperCase())),
  name: z.string().min(1, 'Tên nhà cung cấp không được để trống'),
  phone: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
  address: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
  notes: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1, 'Tên nhà cung cấp không được để trống').optional(),
  phone: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
  address: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
  notes: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (!v || v.trim() === '' ? undefined : v.trim())),
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
