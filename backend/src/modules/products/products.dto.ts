import { z } from 'zod';
import { ProductType, RecipeItemType } from '@prisma/client';

// ==========================================
// 1. PRODUCT CATEGORY SCHEMAS
// ==========================================

export const createProductCategorySchema = z.object({
  code: z
    .string()
    .min(2, 'Mã danh mục tối thiểu 2 ký tự')
    .max(30, 'Mã danh mục tối đa 30 ký tự')
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã danh mục chỉ chứa chữ cái, số, gạch ngang và gạch dưới'),
  name: z.string().min(2, 'Tên danh mục tối thiểu 2 ký tự').max(100, 'Tên danh mục tối đa 100 ký tự'),
});

export const updateProductCategorySchema = createProductCategorySchema.partial();

export type CreateProductCategoryDto = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategoryDto = z.infer<typeof updateProductCategorySchema>;

// ==========================================
// 2. PRODUCT SCHEMAS
// ==========================================

export const createProductSchema = z.object({
  categoryId: z.string().uuid('Danh mục sản phẩm không hợp lệ'),
  sku: z
    .string()
    .min(2, 'Mã SKU tối thiểu 2 ký tự')
    .max(50, 'Mã SKU tối đa 50 ký tự')
    .regex(/^[A-Za-z0-9_-]+$/, 'Mã SKU chỉ chứa chữ cái, số, gạch ngang và gạch dưới'),
  name: z.string().min(2, 'Tên sản phẩm tối thiểu 2 ký tự').max(200, 'Tên sản phẩm tối đa 200 ký tự'),
  imageUrl: z.string().url('Đường dẫn ảnh không hợp lệ').optional().or(z.literal('')),
  type: z.nativeEnum(ProductType, {
    errorMap: () => ({ message: 'Loại sản phẩm phải là FINISHED hoặc INTERMEDIATE' }),
  }),
  sellingPrice: z.number().min(0, 'Giá bán không được âm'),
  description: z.string().max(1000, 'Mô tả tối đa 1000 ký tự').optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const productFilterSchema = z.object({
  categoryId: z.string().uuid().optional(),
  type: z.nativeEnum(ProductType).optional(),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type ProductFilterDto = z.infer<typeof productFilterSchema>;

// ==========================================
// 3. RECIPE (BOM) SCHEMAS
// ==========================================

export const recipeItemSchema = z
  .object({
    itemType: z.nativeEnum(RecipeItemType, {
      errorMap: () => ({ message: 'Loại định mức phải là MATERIAL hoặc SUB_PRODUCT' }),
    }),
    materialId: z.string().uuid().optional(),
    subProductId: z.string().uuid().optional(),
    quantity: z.number().positive('Số lượng định mức phải lớn hơn 0'),
    lossRate: z.number().min(0, 'Tỷ lệ hao hụt không được âm').max(100, 'Tỷ lệ hao hụt tối đa 100%').default(0),
    notes: z.string().max(200).optional(),
  })
  .refine(
    (data) => {
      if (data.itemType === RecipeItemType.MATERIAL) {
        return !!data.materialId && !data.subProductId;
      }
      if (data.itemType === RecipeItemType.SUB_PRODUCT) {
        return !!data.subProductId && !data.materialId;
      }
      return false;
    },
    {
      message: 'Nếu loại là MATERIAL thì phải có materialId, nếu là SUB_PRODUCT thì phải có subProductId',
    }
  );

export const createRecipeSchema = z.object({
  productId: z.string().uuid('ID sản phẩm không hợp lệ'),
  name: z.string().min(2, 'Tên công thức tối thiểu 2 ký tự').max(150, 'Tên công thức tối đa 150 ký tự'),
  notes: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
  isActive: z.boolean().optional().default(true),
  items: z.array(recipeItemSchema).min(1, 'Công thức định mức phải có ít nhất 1 thành phần nguyên liệu/bán thành phẩm'),
});

export const updateRecipeSchema = createRecipeSchema.partial().omit({ productId: true });

export const simulateRecipeCostSchema = z.object({
  productId: z.string().uuid().optional(),
  items: z.array(recipeItemSchema).min(1, 'Cần ít nhất 1 thành phần để mô phỏng tính giá vốn'),
});

export type CreateRecipeDto = z.infer<typeof createRecipeSchema>;
export type UpdateRecipeDto = z.infer<typeof updateRecipeSchema>;
export type RecipeItemDto = z.infer<typeof recipeItemSchema>;
export type SimulateRecipeCostDto = z.infer<typeof simulateRecipeCostSchema>;
